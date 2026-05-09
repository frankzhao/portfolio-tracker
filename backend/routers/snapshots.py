from datetime import date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import Snapshot, Asset, CashFlow, Transaction
from schemas import SnapshotCreate, SnapshotUpdate, SnapshotOut

router = APIRouter(prefix="/snapshots", tags=["snapshots"])


@router.get("/", response_model=list[SnapshotOut])
def list_snapshots(
    asset_id: int | None = None,
    from_period: date | None = None,
    to_period: date | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(Snapshot)
    if asset_id:
        q = q.filter(Snapshot.asset_id == asset_id)
    if from_period:
        q = q.filter(Snapshot.period >= from_period)
    if to_period:
        q = q.filter(Snapshot.period <= to_period)
    return q.order_by(Snapshot.period.desc(), Snapshot.asset_id).all()


@router.post("/", response_model=SnapshotOut, status_code=201)
def create_snapshot(body: SnapshotCreate, db: Session = Depends(get_db)):
    if not db.get(Asset, body.asset_id):
        raise HTTPException(404, f"Asset {body.asset_id} not found")
    # upsert: update if same asset+period already exists
    existing = (
        db.query(Snapshot)
        .filter(Snapshot.asset_id == body.asset_id, Snapshot.period == body.period)
        .first()
    )
    if existing:
        for field, val in body.model_dump(exclude={"asset_id", "period"}).items():
            setattr(existing, field, val)
        db.commit()
        db.refresh(existing)
        return existing
    snap = Snapshot(**body.model_dump())
    db.add(snap)
    db.commit()
    db.refresh(snap)
    return snap


def _build_snap_index(
    db: Session, active_ids: set, up_to: date | None = None
) -> dict[tuple, Decimal]:
    q = db.query(Snapshot).filter(Snapshot.asset_id.in_(active_ids))
    if up_to:
        q = q.filter(Snapshot.period <= up_to)
    return {(s.asset_id, s.period): Decimal(str(s.value_aud)) for s in q.all()}


def _write_derived_for_period(
    db: Session,
    period: date,
    assets: list,
    snap_index: dict,
    last_real_by_asset: dict[int, Decimal],
) -> int:
    """Create/update per-asset derived transactions for a period. Returns count written."""
    # Remove stale derived transactions for this period before rewriting
    db.query(Transaction).filter(
        Transaction.date == period, Transaction.is_derived == True
    ).delete()

    created = 0
    for a in assets:
        if (a.id, period) not in snap_index:
            continue
        current = snap_index[(a.id, period)]
        prev = last_real_by_asset.get(a.id)
        if prev is None or current == prev:
            continue
        delta = current - prev
        db.add(Transaction(
            date=period,
            description="Inferred from portfolio change",
            amount=delta,
            is_derived=True,
            to_asset_id=a.id if delta > 0 else None,
            from_asset_id=a.id if delta < 0 else None,
        ))
        created += 1
    return created


@router.post("/derive-cashflow")
def derive_cashflow(period: date = Query(...), db: Session = Depends(get_db)):
    """Compute and persist per-asset derived transactions for one period. Idempotent."""
    if db.query(CashFlow).filter(CashFlow.period == period).first():
        db.query(Transaction).filter(
            Transaction.date == period, Transaction.is_derived == True
        ).delete()
        db.commit()
        return {"status": "skipped", "reason": "explicit cashflow exists"}

    assets = db.query(Asset).filter(Asset.is_active == True).all()
    active_ids = {a.id for a in assets}
    snap_index = _build_snap_index(db, active_ids, up_to=period)

    # Build last real value per asset from all periods strictly before this one
    last_real_by_asset: dict[int, Decimal] = {}
    for p in sorted({per for (_, per) in snap_index if per < period}):
        for a in assets:
            if (a.id, p) in snap_index:
                last_real_by_asset[a.id] = snap_index[(a.id, p)]

    created = _write_derived_for_period(db, period, assets, snap_index, last_real_by_asset)
    db.commit()
    return {"status": "ok", "created": created}


@router.post("/reconcile-all")
def reconcile_all(db: Session = Depends(get_db)):
    """Recompute all per-asset derived transactions for every period. Idempotent."""
    assets = db.query(Asset).filter(Asset.is_active == True).all()
    active_ids = {a.id for a in assets}
    snap_index = _build_snap_index(db, active_ids)

    all_periods = sorted({p for (_, p) in snap_index})
    explicit_cf_periods = {cf.period for cf in db.query(CashFlow).all()}

    last_real_by_asset: dict[int, Decimal] = {}
    total_created = 0

    for period in all_periods:
        has_new = any((a.id, period) in snap_index for a in assets)
        if not has_new:
            continue

        if period in explicit_cf_periods:
            db.query(Transaction).filter(
                Transaction.date == period, Transaction.is_derived == True
            ).delete()
        else:
            total_created += _write_derived_for_period(
                db, period, assets, snap_index, last_real_by_asset
            )

        # Advance last_real_by_asset regardless of whether CF is explicit
        for a in assets:
            if (a.id, period) in snap_index:
                last_real_by_asset[a.id] = snap_index[(a.id, period)]

    db.commit()
    return {"reconciled": total_created}


@router.get("/{snapshot_id}", response_model=SnapshotOut)
def get_snapshot(snapshot_id: int, db: Session = Depends(get_db)):
    snap = db.get(Snapshot, snapshot_id)
    if not snap:
        raise HTTPException(404, "Snapshot not found")
    return snap


@router.patch("/{snapshot_id}", response_model=SnapshotOut)
def update_snapshot(snapshot_id: int, body: SnapshotUpdate, db: Session = Depends(get_db)):
    snap = db.get(Snapshot, snapshot_id)
    if not snap:
        raise HTTPException(404, "Snapshot not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(snap, field, val)
    db.commit()
    db.refresh(snap)
    return snap


@router.delete("/{snapshot_id}", status_code=204)
def delete_snapshot(snapshot_id: int, db: Session = Depends(get_db)):
    snap = db.get(Snapshot, snapshot_id)
    if not snap:
        raise HTTPException(404, "Snapshot not found")
    db.delete(snap)
    db.commit()
