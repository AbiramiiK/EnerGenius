from types import SimpleNamespace
import pytest

from app.engine import build_scenario
from app.optimizer import run_optimization, STRATEGIES
from app.baseline import run_baseline
from app.validation import validate_steps, summarize


def make_site(**overrides):
    base = dict(
        time_step_minutes=60,
        solar_capacity_kw=100.0,
        solar_inverter_limit_kw=None,
        battery_capacity_kwh=200.0,
        battery_initial_soc_pct=50.0,
        battery_min_soc_pct=10.0,
        battery_max_soc_pct=95.0,
        battery_max_charge_kw=50.0,
        battery_max_discharge_kw=50.0,
        battery_charge_efficiency=0.95,
        battery_discharge_efficiency=0.95,
        typical_daily_demand_kwh=800.0,
        peak_demand_kw=100.0,
        ev_charger_count=2,
        ev_charger_power_kw=11.0,
        ev_default_window_start="09:00",
        ev_default_window_end="17:00",
        ev_default_energy_kwh=20.0,
        grid_max_import_kw=150.0,
        grid_max_export_kw=20.0,
        tariff_flat_rate=0.2,
        tariff_schedule=None,
        grid_carbon_intensity=0.4,
        grid_available=True,
        cost_weight=0.5,
        emissions_weight=0.3,
        battery_weight=0.2,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def test_energy_balance_holds_for_optimized_schedule():
    site = make_site()
    scenario = build_scenario(site, None)
    result = run_optimization(scenario, "cost_efficient")
    assert result["status"] == "optimal"
    validation = validate_steps(scenario, result["steps"])
    balance_check = next(c for c in validation["checks"] if c["name"] == "Energy balance")
    assert balance_check["status"] == "validated"


def test_battery_soc_stays_within_bounds():
    site = make_site()
    scenario = build_scenario(site, None)
    result = run_optimization(scenario, "cost_efficient")
    for s in result["steps"]:
        assert site.battery_min_soc_pct - 0.5 <= s["battery_soc_pct"] <= site.battery_max_soc_pct + 0.5


def test_battery_power_limits_respected():
    site = make_site()
    scenario = build_scenario(site, None)
    result = run_optimization(scenario, "cost_efficient")
    for s in result["steps"]:
        assert s["battery_charge_kw"] <= site.battery_max_charge_kw + 1e-6
        assert s["battery_discharge_kw"] <= site.battery_max_discharge_kw + 1e-6


def test_solar_used_never_exceeds_available():
    site = make_site()
    scenario = build_scenario(site, None)
    result = run_optimization(scenario, "cost_efficient")
    for s in result["steps"]:
        assert s["solar_used_kw"] <= s["solar_generation_kw"] + 1e-6


def test_ev_energy_requirement_is_met_when_feasible():
    site = make_site(ev_charger_count=1, ev_charger_power_kw=20.0, ev_default_energy_kwh=10.0)
    scenario = build_scenario(site, None)
    result = run_optimization(scenario, "cost_efficient")
    assert result["status"] == "optimal"
    total_ev_kwh = sum(s["ev_charging_kw"] for s in result["steps"]) * scenario.dt_hours
    assert total_ev_kwh >= 10.0 - 1e-3


def test_grid_import_never_exceeds_limit():
    site = make_site(grid_max_import_kw=50.0)
    scenario = build_scenario(site, None)
    result = run_optimization(scenario, "cost_efficient")
    assert result["status"] == "optimal"
    for s in result["steps"]:
        assert s["grid_import_kw"] <= 50.0 + 1e-6


def test_infeasible_scenario_reports_infeasible_status():
    # EV requires more energy than the charger could ever deliver in its window
    site = make_site(ev_charger_count=1, ev_charger_power_kw=1.0, ev_default_energy_kwh=1000.0,
                      ev_default_window_start="09:00", ev_default_window_end="10:00")
    scenario = build_scenario(site, None)
    result = run_optimization(scenario, "cost_efficient")
    assert result["status"] == "infeasible"
    assert result["steps"] == []


def test_strategies_change_the_objective_not_just_the_label():
    site = make_site()
    scenario = build_scenario(site, None)
    results = {}
    for strategy in STRATEGIES:
        r = run_optimization(scenario, strategy)
        assert r["status"] == "optimal"
        results[strategy] = summarize(scenario, r["steps"])

    # cost_efficient must not have a worse (higher) cost than more_sustainable
    assert results["cost_efficient"]["total_cost"] <= results["more_sustainable"]["total_cost"] + 1e-6
    # more_sustainable must not have worse emissions than cost_efficient
    assert results["more_sustainable"]["total_emissions_kg"] <= results["cost_efficient"]["total_emissions_kg"] + 1e-6
    # at least one strategy pair must differ meaningfully (objective actually changes behavior)
    costs = {k: v["total_cost"] for k, v in results.items()}
    assert len(set(round(c, 2) for c in costs.values())) >= 2


def test_baseline_and_optimized_are_evaluated_on_identical_scenario():
    site = make_site()
    scenario = build_scenario(site, None)
    optimized = run_optimization(scenario, "cost_efficient")
    baseline = run_baseline(scenario)
    assert len(optimized["steps"]) == len(baseline["steps"])
    for o, b in zip(optimized["steps"], baseline["steps"]):
        assert o["demand_kw"] == b["demand_kw"]
        assert o["solar_generation_kw"] == b["solar_generation_kw"]


def test_optimized_cost_is_never_worse_than_baseline_for_cost_strategy():
    site = make_site()
    scenario = build_scenario(site, None)
    optimized = run_optimization(scenario, "cost_efficient")
    baseline = run_baseline(scenario)
    opt_summary = summarize(scenario, optimized["steps"])
    base_summary = summarize(scenario, baseline["steps"], baseline.get("ev_completion_fraction"))
    assert opt_summary["total_cost"] <= base_summary["total_cost"] + 1e-6
