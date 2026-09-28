from datetime import date as date_type
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/api/daily-inputs", tags=["daily-inputs"])


def _current_site(db: Session) -> models.SiteProfile:
    site = db.query(models.SiteProfile).first()
    if not site:
        raise HTTPException(status_code=404, detail="No site profile configured yet.")
    return site


@router.post("", response_model=schemas.DailyInputOut)
def create_daily_input(payload: schemas.DailyInputIn, db: Session = Depends(get_db)):
    site = _current_site(db)
    existing = db.query(models.DailyInput).filter(
        models.DailyInput.site_id == site.site_id,
        models.DailyInput.operating_date == payload.operating_date,
    ).first()
    if existing:
        for k, v in payload.model_dump().items():
            setattr(existing, k, v)
        db.commit()
        db.refresh(existing)
        return existing
    record = models.DailyInput(site_id=site.site_id, **payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{operating_date}", response_model=schemas.DailyInputOut)
def get_daily_input(operating_date: date_type, db: Session = Depends(get_db)):
    site = _current_site(db)
    record = db.query(models.DailyInput).filter(
        models.DailyInput.site_id == site.site_id,
        models.DailyInput.operating_date == operating_date,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="No daily input recorded for this date yet.")
    return record
