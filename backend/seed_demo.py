#!/usr/bin/env python3
"""
Seed the database with 5 years of synthetic demo data.
Run from the backend/ directory:
    DATABASE_URL=sqlite:///./demo.db python seed_demo.py
"""

import os
import random
import math
from datetime import date, datetime
from decimal import Decimal

# Ensure SQLite connect_args before importing app modules
os.environ.setdefault("DATABASE_URL", "sqlite:///./demo.db")

from database import engine, Base, SessionLocal
from models import Asset, Snapshot, CashFlow, Transaction, Category, FxRate

random.seed(42)

# ── Date range ─────────────────────────────────────────────────────────────────

def months_range(start, n):
    periods, y, m = [], start.year, start.month
    for _ in range(n):
        periods.append(date(y, m, 1))
        m += 1
        if m > 12:
            m, y = 1, y + 1
    return periods

PERIODS = months_range(date(2021, 5, 1), 60)

# ── Value generators ───────────────────────────────────────────────────────────

def bank_walk(start, drift=0.03, vol=0.04, floor=2000):
    v, out = start, []
    for _ in PERIODS:
        v = max(floor, v * (1 + drift / 12 + random.gauss(0, vol) / math.sqrt(12)))
        out.append(round(v, 2))
    return out

def equity_walk(start, drift=0.14, vol=0.18, floor=100):
    v, out = start, []
    for i in range(len(PERIODS)):
        bear = -0.03 if 9 <= i <= 20 else 0.0
        v = max(floor, v * (1 + (drift + bear * 12) / 12 + random.gauss(0, vol) / math.sqrt(12)))
        out.append(round(v, 2))
    return out

def crypto_walk(start, floor=50):
    params = []
    for i in range(len(PERIODS)):
        if i < 7:           params.append((0.12, 0.20))
        elif i < 20:        params.append((-0.10, 0.18))
        elif i < 32:        params.append((0.06, 0.14))
        elif i < 44:        params.append((0.10, 0.18))
        else:               params.append((0.02, 0.22))
    v, out = start, []
    for mu, sigma in params:
        v = max(floor, v * (1 + mu + random.gauss(0, sigma)))
        out.append(round(v, 2))
    return out

# Demo FX: approximate USD/AUD monthly rates 2021-2026
def usd_aud_rates():
    # Rough historical: started ~1.30, peaked ~1.55, settled ~1.55
    base = [
        1.31,1.32,1.33,1.35,1.36,1.36,1.34,1.33,1.35,1.37,1.38,1.40,  # 2021
        1.39,1.38,1.38,1.36,1.37,1.40,1.43,1.44,1.46,1.48,1.49,1.50,  # 2022
        1.49,1.49,1.50,1.51,1.50,1.51,1.52,1.53,1.53,1.54,1.53,1.52,  # 2023
        1.52,1.53,1.54,1.54,1.55,1.56,1.57,1.56,1.55,1.54,1.54,1.55,  # 2024
        1.56,1.57,1.57,1.58,1.57,1.57,1.57,1.57,1.57,1.57,1.57,1.57,  # 2025-26
    ]
    return base[:len(PERIODS)]

USD_RATES = usd_aud_rates()

# ── Asset definitions ──────────────────────────────────────────────────────────

ASSETS = [
    # name        type         currency  color      order  native_values
    ("CBA",       "cash",      "AUD", "#4e8ef7", 0, bank_walk(28_000, 0.04, 0.05)),
    ("Westpac",   "cash",      "AUD", "#2ec27e", 1, bank_walk(14_000, 0.03, 0.06)),
    ("ANZ",       "cash",      "AUD", "#f5a623", 2, bank_walk( 6_000, 0.02, 0.07)),
    ("Stake",     "equities",  "USD", "#e05c5c", 3, equity_walk(4_500, 0.16, 0.17)),
    ("IBKR",      "equities",  "USD", "#b07fd4", 4, equity_walk(8_000, 0.14, 0.14)),
    ("BitX",      "crypto",    "AUD", "#4e8ef7", 5, crypto_walk(3_500)),
    ("CoinVault", "crypto",    "AUD", "#f5a623", 6, crypto_walk(2_000)),
]

# ── Cash flows ─────────────────────────────────────────────────────────────────

def income_series():
    return [round(9_200 * (1 + 0.03 * i / 12 + random.gauss(0, 0.04)), 2) for i in range(60)]

def expense_series():
    return [round(4_800 * (1 + 0.025 * i / 12 + random.gauss(0, 0.05)), 2) for i in range(60)]

# ── Transactions ───────────────────────────────────────────────────────────────

CATEGORIES_DATA = {
    "Groceries":     (-180, -60,  8),
    "Dining":        (-120, -20,  6),
    "Transport":     ( -90, -15,  5),
    "Utilities":     (-220, -80,  2),
    "Entertainment": ( -80, -10,  4),
    "Healthcare":    (-200, -30,  2),
    "Shopping":      (-300, -20,  4),
    "Subscriptions": ( -50, -10,  3),
    "Salary":        (5000, 7500,  1),
    "Freelance":     ( 500, 2500,  1),
}

def make_transactions():
    rows = []
    for period in PERIODS:
        for cat, (lo, hi, freq) in CATEGORIES_DATA.items():
            for _ in range(freq):
                d = date(period.year, period.month, random.randint(1, 28))
                rows.append((d, f"{cat} payment", round(random.uniform(lo, hi), 2), cat))
    rows.sort(key=lambda r: r[0])
    return rows

# ── Seed ───────────────────────────────────────────────────────────────────────

def main():
    print("Creating tables…")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if db.query(Asset).count() > 0:
            print("Database already seeded, skipping.")
            return

        print("Seeding assets…")
        asset_ids = {}
        for name, atype, currency, color, order, _ in ASSETS:
            a = Asset(name=name, type=atype, currency=currency,
                      color=color, display_order=order, is_active=True)
            db.add(a)
            db.flush()
            asset_ids[name] = a.id

        print("Seeding FX rates…")
        for i, period in enumerate(PERIODS):
            db.add(FxRate(
                currency="USD",
                period=period,
                rate=Decimal(str(USD_RATES[i])),
                fetched_at=datetime.utcnow(),
            ))

        print("Seeding snapshots and cashflows…")
        incomes  = income_series()
        expenses = expense_series()

        for i, period in enumerate(PERIODS):
            db.add(CashFlow(
                period=period,
                income=Decimal(str(incomes[i])),
                expenses=Decimal(str(expenses[i])),
            ))
            for name, _, currency, _, _, values in ASSETS:
                native = Decimal(str(values[i]))
                if currency == "USD":
                    fx = Decimal(str(USD_RATES[i]))
                    aud = (native * fx).quantize(Decimal("0.01"))
                else:
                    fx   = None
                    aud  = native
                db.add(Snapshot(
                    asset_id=asset_ids[name],
                    period=period,
                    value_native=native,
                    fx_rate=fx,
                    value_aud=aud,
                ))

        print("Seeding categories…")
        for cat in CATEGORIES_DATA:
            db.add(Category(name=cat))

        print("Seeding transactions…")
        for d, desc, amt, cat in make_transactions():
            db.add(Transaction(
                date=d,
                description=desc,
                amount=Decimal(str(amt)),
                category=cat,
            ))

        db.commit()
        print(f"Done — {len(PERIODS)} months, {len(make_transactions())} transactions.")

    finally:
        db.close()

if __name__ == "__main__":
    main()
