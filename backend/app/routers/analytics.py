from datetime import date as date_type
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.validation import validate_steps
from app.engine import build_scenario

router = APIRouter(prefix="/api", tags=["analytics"])


@router.get("/simulation-runs")
def list_simulation_runs(limit: int = 50, db: Session = Depends(get_db)):
    site = db.query(models.SiteProfile).first()
    if not site:
        raise HTTPException(status_code=404, detail="No site profile configured yet.")
    runs = db.query(models.SimulationRun).filter(
        models.SimulationRun.site_id == site.site_id
    ).order_by(models.SimulationRun.created_at.desc()).limit(limit).all()
    return [{
        "run_id": r.run_id,
        "operating_date": r.operating_date,
        "strategy": r.strategy,
        "solver_status": r.solver_status,
        "objective_value": r.objective_value,
        "created_at": r.created_at,
        "output_snapshot": r.output_snapshot,
    } for r in runs]


@router.get("/simulation-runs/{run_id}")
def get_simulation_run(run_id: str, db: Session = Depends(get_db)):
    run = db.query(models.SimulationRun).filter(models.SimulationRun.run_id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Simulation run not found")
    results = db.query(models.SimulationResult).filter(
        models.SimulationResult.run_id == run_id
    ).order_by(models.SimulationResult.step_index).all()
    return {
        "run_id": run.run_id,
        "site_id": run.site_id,
        "operating_date": run.operating_date,
        "profile_version": run.profile_version,
        "strategy": run.strategy,
        "scenario_params": run.scenario_params,
        "solver_status": run.solver_status,
        "objective_value": run.objective_value,
        "output_snapshot": run.output_snapshot,
        "created_at": run.created_at,
        "steps": [{
            "timestamp": s.timestamp,
            "step_index": s.step_index,
            "solar_generation_kw": s.solar_generation_kw,
            "solar_used_kw": s.solar_used_kw,
            "solar_curtailed_kw": s.solar_curtailed_kw,
            "demand_kw": s.demand_kw,
            "battery_charge_kw": s.battery_charge_kw,
            "battery_discharge_kw": s.battery_discharge_kw,
            "battery_soc_pct": s.battery_soc_pct,
            "ev_charging_kw": s.ev_charging_kw,
            "grid_import_kw": s.grid_import_kw,
            "grid_export_kw": s.grid_export_kw,
            "cost": s.cost,
            "emissions_kg": s.emissions_kg,
            "validation_status": s.validation_status,
        } for s in results],
    }


@router.get("/analytics")
def analytics(start_date: Optional[date_type] = None, end_date: Optional[date_type] = None, db: Session = Depends(get_db)):
    site = db.query(models.SiteProfile).first()
    if not site:
        raise HTTPException(status_code=404, detail="No site profile configured yet.")
    q = db.query(models.SimulationRun).filter(models.SimulationRun.site_id == site.site_id)
    if start_date:
        q = q.filter(models.SimulationRun.operating_date >= start_date)
    if end_date:
        q = q.filter(models.SimulationRun.operating_date <= end_date)
    runs = q.order_by(models.SimulationRun.operating_date).all()

    trend = []
    for r in runs:
        snap = r.output_snapshot or {}
        opt = snap.get("optimized_summary") or {}
        base = snap.get("baseline_summary") or {}
        trend.append({
            "operating_date": r.operating_date,
            "run_id": r.run_id,
            "strategy": r.strategy,
            "solver_status": r.solver_status,
            "optimized": opt,
            "baseline": base,
        })

    return {"site_id": site.site_id, "runs": trend}


@router.get("/system-health/{run_id}")
def system_health(run_id: str, db: Session = Depends(get_db)):
    run = db.query(models.SimulationRun).filter(models.SimulationRun.run_id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Simulation run not found")

    if run.solver_status != "optimal":
        return {
            "run_id": run_id,
            "overall_status": "infeasible",
            "checks": [{"name": "Solver status", "status": "infeasible",
                        "detail": "The optimizer could not find a feasible schedule for this scenario."}],
        }

    site = db.query(models.SiteProfile).filter(models.SiteProfile.site_id == run.site_id).first()
    daily_input = db.query(models.DailyInput).filter(
        models.DailyInput.site_id == run.site_id,
        models.DailyInput.operating_date == run.operating_date,
    ).first()
    scenario = build_scenario(site, daily_input, run.scenario_params)

    results = db.query(models.SimulationResult).filter(models.SimulationResult.run_id == run_id).order_by(models.SimulationResult.step_index).all()
    steps = [{
        "solar_generation_kw": s.solar_generation_kw, "solar_used_kw": s.solar_used_kw,
        "demand_kw": s.demand_kw, "battery_charge_kw": s.battery_charge_kw,
        "battery_discharge_kw": s.battery_discharge_kw, "battery_soc_pct": s.battery_soc_pct,
        "ev_charging_kw": s.ev_charging_kw, "grid_import_kw": s.grid_import_kw,
        "grid_export_kw": s.grid_export_kw,
    } for s in results]

    validation = validate_steps(scenario, steps)
    validation["run_id"] = run_id
    return validation
