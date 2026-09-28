"""Ties together scenario building, optimization, baseline, validation,
KPI summarization, and explanation generation into one reusable call used
by both /api/optimize (persisted) and /api/simulate (preview, not persisted)."""
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from app import models
from app.engine import build_scenario
from app.optimizer import run_optimization
from app.baseline import run_baseline
from app.validation import validate_steps, summarize
from app.explain import generate_recommendations


def execute_scenario(db: Session, site: models.SiteProfile, daily_input: Optional[models.DailyInput],
                      strategy: str, overrides: Optional[Dict[str, Any]], operating_date,
                      persist: bool) -> Dict[str, Any]:
    scenario = build_scenario(site, daily_input, overrides)

    weights = {
        "cost_weight": site.cost_weight,
        "emissions_weight": site.emissions_weight,
        "battery_weight": site.battery_weight,
    }
    if overrides:
        for k in ("cost_weight", "emissions_weight", "battery_weight"):
            if k in overrides:
                weights[k] = overrides[k]

    opt_result = run_optimization(scenario, strategy, weights)
    baseline_result = run_baseline(scenario)

    result: Dict[str, Any] = {
        "strategy": strategy,
        "strategy_description": None,
        "solver_status": opt_result["status"],
        "solver_message": opt_result.get("solver_message"),
        "data_labels": {
            "solar_synthetic": scenario.solar_labeled_synthetic,
            "demand_synthetic": scenario.demand_labeled_synthetic,
        },
    }

    from app.optimizer import STRATEGY_DESCRIPTIONS
    result["strategy_description"] = STRATEGY_DESCRIPTIONS.get(strategy)

    baseline_summary = summarize(scenario, baseline_result["steps"], baseline_result.get("ev_completion_fraction"))
    baseline_validation = validate_steps(scenario, baseline_result["steps"])
    result["baseline"] = {
        "steps": baseline_result["steps"],
        "summary": baseline_summary,
        "validation": baseline_validation,
        "status": baseline_result["status"],
    }

    if opt_result["status"] != "optimal":
        result["optimized"] = {
            "steps": [],
            "summary": None,
            "validation": None,
            "status": opt_result["status"],
        }
        result["recommendations"] = [{
            "title": "Optimization infeasible",
            "recommendation": "No feasible schedule was found for this scenario.",
            "why": "One or more constraints (EV energy requirement, grid limits, battery limits) could not be satisfied simultaneously.",
            "inputs_considered": {},
            "constraints": ["All configured constraints"],
            "expected_effect": "No optimized schedule is available; only the baseline is shown.",
            "trade_off": "N/A",
            "uncertainty": "Try relaxing EV requirements, increasing grid import limits, or increasing battery capacity.",
        }]
        run_id = None
        if persist:
            run = models.SimulationRun(
                site_id=site.site_id,
                operating_date=operating_date,
                profile_version=site.profile_version,
                strategy=strategy,
                scenario_params=overrides or {},
                solver_status=opt_result["status"],
                objective_value=None,
                input_snapshot={"n_steps": scenario.n_steps},
                output_snapshot={"baseline_summary": baseline_summary, "optimized_summary": None},
            )
            db.add(run)
            db.commit()
            db.refresh(run)
            run_id = run.run_id
        result["run_id"] = run_id
        return result

    optimized_summary = summarize(scenario, opt_result["steps"])
    optimized_validation = validate_steps(scenario, opt_result["steps"])
    result["optimized"] = {
        "steps": opt_result["steps"],
        "summary": optimized_summary,
        "validation": optimized_validation,
        "status": "optimal",
        "objective_value": opt_result["objective_value"],
    }

    comparison = {}
    for key in ("total_cost", "total_emissions_kg", "renewable_share", "peak_grid_import_kw",
                "battery_cycling_kwh", "ev_completion_fraction"):
        b = baseline_summary[key]
        o = optimized_summary[key]
        comparison[key] = {
            "baseline": b,
            "optimized": o,
            "absolute_diff": round(o - b, 4),
            "pct_diff": round(100 * (o - b) / b, 2) if b not in (0, None) else None,
        }
    result["comparison"] = comparison

    result["recommendations"] = generate_recommendations(
        scenario, opt_result["steps"], baseline_summary, optimized_summary, strategy
    )

    run_id = None
    if persist:
        run = models.SimulationRun(
            site_id=site.site_id,
            operating_date=operating_date,
            profile_version=site.profile_version,
            strategy=strategy,
            scenario_params=overrides or {},
            solver_status="optimal",
            objective_value=opt_result["objective_value"],
            input_snapshot={"n_steps": scenario.n_steps, "overrides": overrides or {}},
            output_snapshot={
                "baseline_summary": baseline_summary,
                "optimized_summary": optimized_summary,
                "comparison": comparison,
            },
        )
        db.add(run)
        db.commit()
        db.refresh(run)
        run_id = run.run_id

        for s in opt_result["steps"]:
            db.add(models.SimulationResult(
                run_id=run_id,
                timestamp=s["timestamp"],
                step_index=s["step_index"],
                solar_generation_kw=s["solar_generation_kw"],
                solar_used_kw=s["solar_used_kw"],
                solar_curtailed_kw=s["solar_curtailed_kw"],
                demand_kw=s["demand_kw"],
                battery_charge_kw=s["battery_charge_kw"],
                battery_discharge_kw=s["battery_discharge_kw"],
                battery_soc_pct=s["battery_soc_pct"],
                ev_charging_kw=s["ev_charging_kw"],
                grid_import_kw=s["grid_import_kw"],
                grid_export_kw=s["grid_export_kw"],
                cost=s["cost"],
                emissions_kg=s["emissions_kg"],
                validation_status=optimized_validation["overall_status"],
            ))
        db.commit()

    result["run_id"] = run_id
    return result
