from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.core_run import execute_scenario
from app.optimizer import STRATEGIES

router = APIRouter(prefix="/api", tags=["optimize"])


def _get_site_and_input(db: Session, operating_date):
    site = db.query(models.SiteProfile).first()
    if not site:
        raise HTTPException(status_code=404, detail="No site profile configured yet.")
    daily_input = db.query(models.DailyInput).filter(
        models.DailyInput.site_id == site.site_id,
        models.DailyInput.operating_date == operating_date,
    ).first()
    return site, daily_input


@router.post("/optimize")
def optimize(payload: schemas.OptimizeRequest, db: Session = Depends(get_db)):
    if payload.strategy not in STRATEGIES:
        raise HTTPException(status_code=400, detail=f"strategy must be one of {STRATEGIES}")
    site, daily_input = _get_site_and_input(db, payload.operating_date)
    result = execute_scenario(
        db, site, daily_input, payload.strategy, payload.scenario_overrides,
        payload.operating_date, persist=True,
    )
    return result


@router.post("/simulate")
def simulate(payload: schemas.OptimizeRequest, db: Session = Depends(get_db)):
    if payload.strategy not in STRATEGIES:
        raise HTTPException(status_code=400, detail=f"strategy must be one of {STRATEGIES}")
    site, daily_input = _get_site_and_input(db, payload.operating_date)
    result = execute_scenario(
        db, site, daily_input, payload.strategy, payload.scenario_overrides,
        payload.operating_date, persist=False,
    )
    return result
