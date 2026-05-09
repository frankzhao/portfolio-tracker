from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from database import get_db
from models import Category, Transaction
from schemas import CategoryCreate, CategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("/", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    managed = {c.name: c for c in db.query(Category).order_by(Category.name).all()}

    tx_cats: set[str] = {
        row[0]
        for row in db.query(Transaction.category)
        .filter(Transaction.category.isnot(None))
        .distinct()
        .all()
    }

    all_names = managed.keys() | tx_cats
    counts: dict[str, int] = {
        row[0]: row[1]
        for row in db.query(Transaction.category, func.count(Transaction.id))
        .filter(Transaction.category.in_(all_names))
        .group_by(Transaction.category)
        .all()
    }

    result = []
    for name in sorted(all_names):
        cat = managed.get(name)
        result.append(CategoryOut(
            id=cat.id if cat else None,
            name=name,
            tx_count=counts.get(name, 0),
        ))
    return result


@router.post("/", response_model=CategoryOut, status_code=201)
def create_category(body: CategoryCreate, db: Session = Depends(get_db)):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Category name cannot be empty")
    if db.query(Category).filter(Category.name == name).first():
        raise HTTPException(409, f"Category '{name}' already exists")
    cat = Category(name=name)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return CategoryOut(id=cat.id, name=cat.name, tx_count=0)


@router.delete("/{category_id}", status_code=204)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.get(Category, category_id)
    if not cat:
        raise HTTPException(404, "Category not found")
    db.delete(cat)
    db.commit()
