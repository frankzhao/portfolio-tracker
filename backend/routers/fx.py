import calendar
import json
import urllib.error
import urllib.request
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models import FxRate

router = APIRouter(prefix="/fx-rates", tags=["fx-rates"])

SUPPORTED = ["USD", "EUR", "GBP"]


def _fetch_monthly_avg(currency: str, period: date, end_date: date) -> float:
    url = (
        f"https://api.frankfurter.app/{period}..{end_date}"
        f"?from={currency}&to=AUD"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "portfolio-tracker/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        raise HTTPException(502, f"Frankfurter returned {exc.code} for {currency}/AUD")
    except Exception as exc:
        raise HTTPException(502, f"Failed to fetch {currency}/AUD: {exc}")

    daily = [v["AUD"] for v in data.get("rates", {}).values()]
    if not daily:
        raise HTTPException(502, f"No rates returned for {currency}/AUD in {period}")
    return round(sum(daily) / len(daily), 6)


@router.get("/")
def get_fx_rates(
    period: date = Query(..., description="First day of the month (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
):
    last_day = calendar.monthrange(period.year, period.month)[1]
    # Cap end date at yesterday to avoid requesting future/unpublished rates
    end_date = min(date(period.year, period.month, last_day), date.today() - timedelta(days=1))
    if end_date < period:
        raise HTTPException(400, "Period is in the future — no rates available yet")

    result: dict[str, float] = {}

    for currency in SUPPORTED:
        cached = (
            db.query(FxRate)
            .filter(FxRate.currency == currency, FxRate.period == period)
            .first()
        )
        if cached:
            result[currency] = float(str(cached.rate))
            continue

        rate = _fetch_monthly_avg(currency, period, end_date)
        db.add(FxRate(currency=currency, period=period, rate=rate, fetched_at=datetime.utcnow()))
        db.commit()
        result[currency] = rate

    return result


@router.delete("/")
def bust_fx_cache(
    period: date = Query(..., description="First day of the month to re-fetch"),
    db: Session = Depends(get_db),
):
    """Delete cached rates for a period so the next GET re-fetches from Frankfurter."""
    deleted = db.query(FxRate).filter(FxRate.period == period).delete()
    db.commit()
    return {"deleted": deleted}
