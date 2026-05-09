from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Asset
from schemas import AssetCreate, AssetUpdate, AssetOut

router = APIRouter(prefix="/assets", tags=["assets"])


@router.get("/", response_model=list[AssetOut])
def list_assets(include_inactive: bool = False, db: Session = Depends(get_db)):
    q = db.query(Asset)
    if not include_inactive:
        q = q.filter(Asset.is_active == True)
    return q.order_by(Asset.display_order, Asset.id).all()


@router.post("/", response_model=AssetOut, status_code=201)
def create_asset(body: AssetCreate, db: Session = Depends(get_db)):
    if db.query(Asset).filter(Asset.name == body.name).first():
        raise HTTPException(400, f"Asset '{body.name}' already exists")
    asset = Asset(**body.model_dump())
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.get("/{asset_id}", response_model=AssetOut)
def get_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(404, "Asset not found")
    return asset


@router.patch("/{asset_id}", response_model=AssetOut)
def update_asset(asset_id: int, body: AssetUpdate, db: Session = Depends(get_db)):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(404, "Asset not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(asset, field, val)
    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/{asset_id}", status_code=204)
def delete_asset(asset_id: int, db: Session = Depends(get_db)):
    asset = db.get(Asset, asset_id)
    if not asset:
        raise HTTPException(404, "Asset not found")
    db.delete(asset)
    db.commit()
