from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
import logging

from app.database import init_db, get_db
from app import models
from app.routers import site_profile, daily_inputs, upload, forecast, optimize, analytics

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("energenius")

app = FastAPI(title="EnerGenius API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://ener-genius.vercel.app",
],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request, exc):
    logger.exception("Unhandled error")
    return JSONResponse(status_code=500, content={"detail": "Internal server error. Please try again."})


@app.on_event("startup")
def on_startup():
    init_db()


app.include_router(site_profile.router)
app.include_router(daily_inputs.router)
app.include_router(upload.router)
app.include_router(forecast.router)
app.include_router(optimize.router)
app.include_router(analytics.router)


@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    has_profile = db.query(models.SiteProfile).first() is not None
    return {"status": "ok", "site_configured": has_profile}


DEMO_PROFILE = {
    "site_name": "Riverside Campus (Demo)",
    "site_type": "campus",
    "timezone": "UTC",
    "operating_days": ["Mon", "Tue", "Wed", "Thu", "Fri"],
    "operating_hours": {"start": "08:00", "end": "18:00"},
    "time_step_minutes": 60,
    "solar_capacity_kw": 100.0,
    "solar_inverter_limit_kw": 110.0,
    "solar_notes": "Synthetic demo data",
    "battery_capacity_kwh": 250.0,
    "battery_initial_soc_pct": 50.0,
    "battery_min_soc_pct": 10.0,
    "battery_max_soc_pct": 95.0,
    "battery_max_charge_kw": 60.0,
    "battery_max_discharge_kw": 60.0,
    "battery_charge_efficiency": 0.95,
    "battery_discharge_efficiency": 0.95,
    "typical_daily_demand_kwh": 900.0,
    "peak_demand_kw": 120.0,
    "essential_load_kw": 30.0,
    "ev_charger_count": 4,
    "ev_charger_power_kw": 11.0,
    "ev_default_window_start": "09:00",
    "ev_default_window_end": "17:00",
    "ev_default_energy_kwh": 25.0,
    "grid_max_import_kw": 150.0,
    "grid_max_export_kw": 30.0,
    "tariff_flat_rate": 0.18,
    "tariff_schedule": [
        {"start": "00:00", "end": "07:00", "rate": 0.10},
        {"start": "07:00", "end": "17:00", "rate": 0.18},
        {"start": "17:00", "end": "21:00", "rate": 0.28},
        {"start": "21:00", "end": "24:00", "rate": 0.12},
    ],
    "grid_carbon_intensity": 0.45,
    "grid_available": True,
    "default_strategy": "cost_efficient",
    "cost_weight": 0.5,
    "emissions_weight": 0.3,
    "battery_weight": 0.2,
    "is_demo": True,
}


@app.post("/api/demo/load-sample")
def load_sample_profile(db: Session = Depends(get_db)):
    existing = db.query(models.SiteProfile).first()
    if existing:
        for k, v in DEMO_PROFILE.items():
            setattr(existing, k, v)
        existing.profile_version += 1
        db.commit()
        db.refresh(existing)
        return existing
    profile = models.SiteProfile(**DEMO_PROFILE, profile_version=1)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile
