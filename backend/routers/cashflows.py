from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import CashFlow
from schemas import CashFlowCreate, CashFlowUpdate, CashFlowOut

router = APIRouter(prefix="/cashflows", tags=["cashflows"])


@router.get("/", response_model=list[CashFlowOut])
def list_cashflows(
    from_period: date | None = None,
    to_period: date | None = None,
    db: Session = Depends(get_db),
):
    q = db.query(CashFlow)
    if from_period:
        q = q.filter(CashFlow.period >= from_period)
    if to_period:
        q = q.filter(CashFlow.period <= to_period)
    return q.order_by(CashFlow.period.desc()).all()


@router.post("/", response_model=CashFlowOut, status_code=201)
def upsert_cashflow(body: CashFlowCreate, db: Session = Depends(get_db)):
    existing = db.query(CashFlow).filter(CashFlow.period == body.period).first()
    if existing:
        for field, val in body.model_dump(exclude={"period"}).items():
            setattr(existing, field, val)
        db.commit()
        db.refresh(existing)
        return existing
    cf = CashFlow(**body.model_dump())
    db.add(cf)
    db.commit()
    db.refresh(cf)
    return cf


@router.patch("/{cf_id}", response_model=CashFlowOut)
def update_cashflow(cf_id: int, body: CashFlowUpdate, db: Session = Depends(get_db)):
    cf = db.get(CashFlow, cf_id)
    if not cf:
        raise HTTPException(404, "CashFlow not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(cf, field, val)
    db.commit()
    db.refresh(cf)
    return cf


@router.delete("/{cf_id}", status_code=204)
def delete_cashflow(cf_id: int, db: Session = Depends(get_db)):
    cf = db.get(CashFlow, cf_id)
    if not cf:
        raise HTTPException(404, "CashFlow not found")
    db.delete(cf)
    db.commit()
