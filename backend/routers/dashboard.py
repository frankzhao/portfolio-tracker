from decimal import Decimal
from typing import Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import Snapshot, CashFlow, Asset
from schemas import DashboardOut, PeriodSummary, AssetOut

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/", response_model=DashboardOut)
def get_dashboard(db: Session = Depends(get_db)):
    assets = db.query(Asset).filter(Asset.is_active == True).order_by(Asset.display_order).all()

    # All periods that have at least one snapshot, ascending
    periods = (
        db.query(Snapshot.period)
        .distinct()
        .order_by(Snapshot.period)
        .all()
    )
    periods = [r[0] for r in periods]

    # Build cashflow lookup
    cf_by_period = {
        cf.period: cf
        for cf in db.query(CashFlow).all()
    }

    # Load all snapshots upfront for forward-fill
    active_ids = {a.id for a in assets}
    snap_index: dict[tuple[int, Any], Decimal] = {
        (s.asset_id, s.period): Decimal(str(s.value_aud))
        for s in db.query(Snapshot).filter(Snapshot.asset_id.in_(active_ids)).all()
    }

    history: list[PeriodSummary] = []
    prev_total: Decimal | None = None
    last_known: dict[int, Decimal] = {}  # asset_id -> most recent value_aud seen so far
    last_real_total: Decimal | None = None  # total at last period with actual new snapshots

    for period in periods:
        breakdown: dict[str, Decimal] = {}
        has_new_snapshot = False
        for a in assets:
            key = (a.id, period)
            if key in snap_index:
                last_known[a.id] = snap_index[key]
                has_new_snapshot = True
            if a.id in last_known:
                breakdown[a.name] = last_known[a.id]

        total = sum(breakdown.values(), Decimal("0"))

        cf = cf_by_period.get(period)
        if cf:
            income = Decimal(str(cf.income))
            expenses = Decimal(str(cf.expenses))
        elif has_new_snapshot and last_real_total is not None:
            # Infer from delta vs last period that had real data (skips forward-filled gaps)
            delta = total - last_real_total
            income   = delta if delta > 0 else Decimal("0")
            expenses = -delta if delta < 0 else Decimal("0")
        else:
            income = Decimal("0")
            expenses = Decimal("0")

        if has_new_snapshot:
            last_real_total = total

        growth_pct = None
        if prev_total and prev_total > 0:
            growth_pct = ((total - prev_total) / prev_total * 100).quantize(Decimal("0.01"))

        history.append(PeriodSummary(
            period=period,
            total_aud=total,
            breakdown=breakdown,
            income=income,
            expenses=expenses,
            net_flow=income - expenses,
            growth_pct=growth_pct,
        ))
        prev_total = total

    latest_total = history[-1].total_aud if history else Decimal("0")
    latest_period = history[-1].period if history else None

    # YTD growth
    ytd_growth_pct = None
    if history:
        current_year = latest_period.year if latest_period else None
        ytd_start = next(
            (h for h in history if h.period.year == current_year),
            None,
        )
        if ytd_start and ytd_start.total_aud > 0:
            ytd_growth_pct = (
                (latest_total - ytd_start.total_aud) / ytd_start.total_aud * 100
            ).quantize(Decimal("0.01"))

    # All-time growth
    all_time_growth_pct = None
    if len(history) >= 2 and history[0].total_aud > 0:
        all_time_growth_pct = (
            (latest_total - history[0].total_aud) / history[0].total_aud * 100
        ).quantize(Decimal("0.01"))

    def _growth_over_n_months(n: int) -> Decimal | None:
        if len(history) <= n:
            return None
        base = history[-(n + 1)].total_aud
        if base <= 0:
            return None
        return ((latest_total - base) / base * 100).quantize(Decimal("0.01"))

    return DashboardOut(
        latest_total=latest_total,
        latest_period=latest_period,
        growth_3m_pct=_growth_over_n_months(3),
        growth_6m_pct=_growth_over_n_months(6),
        ytd_growth_pct=ytd_growth_pct,
        all_time_growth_pct=all_time_growth_pct,
        history=history,
        asset_types=[AssetOut.model_validate(a) for a in assets],
    )
