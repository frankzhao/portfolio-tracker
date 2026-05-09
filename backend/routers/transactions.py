from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from sqlalchemy.orm import joinedload

from database import get_db
from models import Transaction
from schemas import TransactionCreate, TransactionUpdate, TransactionOut

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.get("/", response_model=list[TransactionOut])
def list_transactions(
    from_date: date | None = None,
    to_date: date | None = None,
    category: str | None = None,
    asset_id: int | None = None,
    limit: int = Query(500, le=2000),
    offset: int = 0,
    db: Session = Depends(get_db),
):
    q = db.query(Transaction).options(
        joinedload(Transaction.from_asset),
        joinedload(Transaction.to_asset),
    )
    if from_date:
        q = q.filter(Transaction.date >= from_date)
    if to_date:
        q = q.filter(Transaction.date <= to_date)
    if category:
        q = q.filter(Transaction.category == category)
    if asset_id:
        q = q.filter(
            (Transaction.from_asset_id == asset_id) | (Transaction.to_asset_id == asset_id)
        )
    rows = q.order_by(Transaction.date.desc()).offset(offset).limit(limit).all()
    return rows


@router.post("/", response_model=TransactionOut, status_code=201)
def create_transaction(body: TransactionCreate, db: Session = Depends(get_db)):
    t = Transaction(**body.model_dump())
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.post("/bulk", response_model=dict, status_code=201)
def bulk_create_transactions(body: list[TransactionCreate], db: Session = Depends(get_db)):
    rows = [Transaction(**t.model_dump()) for t in body]
    db.bulk_save_objects(rows)
    db.commit()
    return {"inserted": len(rows)}


@router.patch("/{tx_id}", response_model=TransactionOut)
def update_transaction(tx_id: int, body: TransactionUpdate, db: Session = Depends(get_db)):
    t = db.get(Transaction, tx_id)
    if not t:
        raise HTTPException(404, "Transaction not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(t, field, val)
    t.is_derived = False  # editing promotes it to an explicit transaction
    db.commit()
    db.refresh(t)
    return t


@router.delete("/{tx_id}", status_code=204)
def delete_transaction(tx_id: int, db: Session = Depends(get_db)):
    t = db.get(Transaction, tx_id)
    if not t:
        raise HTTPException(404, "Transaction not found")
    db.delete(t)
    db.commit()


@router.get("/categories", response_model=list[str])
def list_categories(db: Session = Depends(get_db)):
    rows = db.query(Transaction.category).distinct().filter(Transaction.category != None).all()
    return sorted(r[0] for r in rows)
