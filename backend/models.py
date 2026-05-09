from datetime import date, datetime
from sqlalchemy import (
    Column, Integer, String, Numeric, Date, DateTime,
    ForeignKey, Boolean, Text, Enum as SAEnum
)
from sqlalchemy.orm import relationship
import enum

from database import Base


class AssetType(str, enum.Enum):
    cash = "cash"
    equities = "equities"
    crypto = "crypto"
    property = "property"
    bonds = "bonds"
    other = "other"


class Currency(str, enum.Enum):
    AUD = "AUD"
    USD = "USD"
    EUR = "EUR"
    GBP = "GBP"


class Asset(Base):
    """User-defined asset / account (e.g. 'CBA Savings', 'CommSec', 'Bitcoin')."""
    __tablename__ = "assets"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False, unique=True)
    type = Column(SAEnum(AssetType), nullable=False, default=AssetType.cash)
    currency = Column(SAEnum(Currency), nullable=False, default=Currency.AUD)
    color = Column(String(20), nullable=True)   # hex colour for charts
    display_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    snapshots = relationship("Snapshot", back_populates="asset", cascade="all, delete-orphan")


class Snapshot(Base):
    """End-of-period valuation for a single asset."""
    __tablename__ = "snapshots"

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"), nullable=False)
    period = Column(Date, nullable=False)           # first day of the month
    value_native = Column(Numeric(18, 2), nullable=False)  # in the asset's own currency
    fx_rate = Column(Numeric(10, 6), nullable=True)        # rate to AUD at snapshot time
    value_aud = Column(Numeric(18, 2), nullable=False)     # computed AUD value
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    asset = relationship("Asset", back_populates="snapshots")


class CashFlow(Base):
    """Monthly income / outflow summary (separate from asset valuations)."""
    __tablename__ = "cash_flows"

    id = Column(Integer, primary_key=True, index=True)
    period = Column(Date, nullable=False)           # first day of month
    income = Column(Numeric(18, 2), default=0)
    expenses = Column(Numeric(18, 2), default=0)   # stored as positive number
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Category(Base):
    """User-defined transaction category."""
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(80), nullable=False, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class FxRate(Base):
    """Cached monthly-average exchange rate to AUD, fetched from Frankfurter."""
    __tablename__ = "fx_rates"

    id = Column(Integer, primary_key=True, index=True)
    currency = Column(String(3), nullable=False)   # e.g. 'USD'
    period = Column(Date, nullable=False)           # first day of the month
    rate = Column(Numeric(14, 6), nullable=False)  # units of AUD per 1 foreign unit
    fetched_at = Column(DateTime, default=datetime.utcnow)


class Transaction(Base):
    """Individual income/expense transaction (from bank exports)."""
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    description = Column(Text, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)   # negative = expense, positive = income
    category = Column(String(80), nullable=True)
    source = Column(String(80), nullable=True)        # e.g. 'CBA', 'NAB'
    from_asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True)
    to_asset_id = Column(Integer, ForeignKey("assets.id"), nullable=True)
    is_derived = Column(Boolean, default=False)  # True = inferred from snapshot delta
    created_at = Column(DateTime, default=datetime.utcnow)

    from_asset = relationship("Asset", foreign_keys=[from_asset_id])
    to_asset = relationship("Asset", foreign_keys=[to_asset_id])
