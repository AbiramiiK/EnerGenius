from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models, schemas
from app.forecasting import forecast_series, _load_history

router = APIRouter(prefix="/api/forecast", tags=["forecast"])


@router.post("")
def forecast(payload: schemas.ForecastRequest, db: Session = Depends(get_db)):
    site = db.query(models.SiteProfile).first()
    if not site:
        raise HTTPException(status_code=404, detail="No site profile configured yet.")

    if payload.target not in ("solar", "demand"):
        raise HTTPException(status_code=400, detail="target must be 'solar' or 'demand'")

    n_steps = payload.horizon_steps or int(24 * 60 / site.time_step_minutes)

    dataset = db.query(models.UploadedDataset).filter(
        models.UploadedDataset.site_id == site.site_id,
        models.UploadedDataset.kind == payload.target,
    ).order_by(models.UploadedDataset.uploaded_at.desc()).first()

    history_df = None
    value_col = "solar_kw" if payload.target == "solar" else "demand_kw"
    if dataset:
        history_df = _load_history(dataset.storage_path)

    capacity_or_total = site.solar_capacity_kw if payload.target == "solar" else (
        site.typical_daily_demand_kwh or (site.peak_demand_kw or 50) * 10
    )

    result = forecast_series(
        target=payload.target,
        n_steps=n_steps,
        dt_minutes=site.time_step_minutes,
        capacity_or_total=capacity_or_total,
        history_df=history_df,
        value_col=value_col if history_df is not None and value_col in history_df.columns else None,
        timestamp_col="timestamp" if history_df is not None else None,
    )
    return result
