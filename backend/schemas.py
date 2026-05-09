from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, field_validator

from models import AssetType, Currency


# ── Categories ────────────────────────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str

class CategoryOut(BaseModel):
    id: Optional[int] = None  # None for transaction-derived categories not yet in the managed table
    name: str
    tx_count: int = 0

    model_config = {"from_attributes": True}


# ── Assets ────────────────────────────────────────────────────────────────────

class AssetBase(BaseModel):
    name: str
    type: AssetType = AssetType.cash
    currency: Currency = Currency.AUD
    color: Optional[str] = None
    display_order: int = 0
    is_active: bool = True
    notes: Optional[str] = None


class AssetCreate(AssetBase):
    pass


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[AssetType] = None
    currency: Optional[Currency] = None
    color: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class AssetOut(AssetBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Snapshots ─────────────────────────────────────────────────────────────────

class SnapshotBase(BaseModel):
    asset_id: int
    period: date
    value_native: Decimal
    fx_rate: Optional[Decimal] = None
    value_aud: Decimal
    notes: Optional[str] = None


class SnapshotCreate(SnapshotBase):
    pass


class SnapshotUpdate(BaseModel):
    value_native: Optional[Decimal] = None
    fx_rate: Optional[Decimal] = None
    value_aud: Optional[Decimal] = None
    notes: Optional[str] = None


class SnapshotOut(SnapshotBase):
    id: int
    created_at: datetime
    updated_at: datetime
    asset: AssetOut

    model_config = {"from_attributes": True}


# ── Cash Flows ────────────────────────────────────────────────────────────────

class CashFlowBase(BaseModel):
    period: date
    income: Decimal = Decimal("0")
    expenses: Decimal = Decimal("0")
    notes: Optional[str] = None


class CashFlowCreate(CashFlowBase):
    pass


class CashFlowUpdate(BaseModel):
    income: Optional[Decimal] = None
    expenses: Optional[Decimal] = None
    notes: Optional[str] = None


class CashFlowOut(CashFlowBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Transactions ──────────────────────────────────────────────────────────────

class TransactionBase(BaseModel):
    date: date
    description: str
    amount: Decimal
    category: Optional[str] = None
    from_asset_id: Optional[int] = None
    to_asset_id: Optional[int] = None
    is_derived: bool = False


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    date: Optional[date] = None
    description: Optional[str] = None
    amount: Optional[Decimal] = None
    category: Optional[str] = None
    from_asset_id: Optional[int] = None
    to_asset_id: Optional[int] = None


class TransactionOut(TransactionBase):
    id: int
    created_at: datetime
    from_asset: Optional[AssetOut] = None
    to_asset: Optional[AssetOut] = None

    model_config = {"from_attributes": True}


# ── Dashboard ─────────────────────────────────────────────────────────────────

class PeriodSummary(BaseModel):
    period: date
    total_aud: Decimal
    breakdown: dict[str, Decimal]        # asset_name -> value_aud
    income: Decimal
    expenses: Decimal
    net_flow: Decimal
    growth_pct: Optional[Decimal]        # MoM growth vs prior period


class DashboardOut(BaseModel):
    latest_total: Decimal
    latest_period: Optional[date]
    growth_3m_pct: Optional[Decimal]
    growth_6m_pct: Optional[Decimal]
    ytd_growth_pct: Optional[Decimal]
    all_time_growth_pct: Optional[Decimal]
    history: list[PeriodSummary]
    asset_types: list[AssetOut]
