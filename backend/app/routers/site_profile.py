from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas

router = APIRouter(prefix="/api/site-profile", tags=["site-profile"])


@router.post("", response_model=schemas.SiteProfileOut)
def create_site_profile(payload: schemas.SiteProfileIn, db: Session = Depends(get_db)):
    existing = db.query(models.SiteProfile).first()
    if existing:
        for k, v in payload.model_dump().items():
            setattr(existing, k, v)
        existing.profile_version += 1
        db.commit()
        db.refresh(existing)
        return existing
    profile = models.SiteProfile(**payload.model_dump(), profile_version=1)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("", response_model=schemas.SiteProfileOut)
def get_site_profile(db: Session = Depends(get_db)):
    profile = db.query(models.SiteProfile).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No site profile configured yet. Complete first-time setup.")
    return profile


@router.put("/{site_id}", response_model=schemas.SiteProfileOut)
def update_site_profile(site_id: str, payload: schemas.SiteProfileIn, db: Session = Depends(get_db)):
    profile = db.query(models.SiteProfile).filter(models.SiteProfile.site_id == site_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Site profile not found")
    for k, v in payload.model_dump().items():
        setattr(profile, k, v)
    profile.profile_version += 1
    db.commit()
    db.refresh(profile)
    return profile
