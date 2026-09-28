"""Post-hoc validation of a produced schedule (used by System Health) and
KPI summarization shared by optimized and baseline schedules."""
from typing import Dict, Any, List
from app.engine import Scenario

TOLERANCE_KW = 0.05


def validate_steps(scenario: Scenario, steps: List[Dict[str, Any]]) -> Dict[str, Any]:
    checks = []
    cap_kwh = scenario.battery_capacity_kwh
    soc_min_pct = scenario.battery_min_soc_pct
    soc_max_pct = scenario.battery_max_soc_pct

    balance_ok = True
    soc_ok = True
    battery_power_ok = True
    solar_ok = True
    grid_ok = True

    for s in steps:
        lhs = s["solar_used_kw"] + s["battery_discharge_kw"] + s["grid_import_kw"]
        rhs = s["demand_kw"] + s["battery_charge_kw"] + s["ev_charging_kw"] + s["grid_export_kw"]
        if abs(lhs - rhs) > TOLERANCE_KW:
            balance_ok = False
        if not (soc_min_pct - 0.5 <= s["battery_soc_pct"] <= soc_max_pct + 0.5):
            soc_ok = False
        if s["battery_charge_kw"] > scenario.battery_max_charge_kw + TOLERANCE_KW:
            battery_power_ok = False
        if s["battery_discharge_kw"] > scenario.battery_max_discharge_kw + TOLERANCE_KW:
            battery_power_ok = False
        if s["solar_used_kw"] > s["solar_generation_kw"] + TOLERANCE_KW:
            solar_ok = False
        if s["grid_import_kw"] > scenario.grid_max_import_kw + TOLERANCE_KW:
            grid_ok = False
        if s["grid_export_kw"] > scenario.grid_max_export_kw + TOLERANCE_KW:
            grid_ok = False

    def status(ok: bool) -> str:
        return "validated" if ok else "warning"

    checks.append({"name": "Energy balance", "status": status(balance_ok),
                    "detail": "Supply equals demand at every time step within tolerance." if balance_ok
                    else "Supply/demand mismatch detected at one or more time steps."})
    checks.append({"name": "Battery SOC limits", "status": status(soc_ok),
                    "detail": f"SOC stayed within [{soc_min_pct}%, {soc_max_pct}%]." if soc_ok
                    else "SOC exceeded configured bounds at one or more steps."})
    checks.append({"name": "Battery power limits", "status": status(battery_power_ok),
                    "detail": "Charge/discharge power stayed within configured limits." if battery_power_ok
                    else "Battery charge or discharge power exceeded configured limits."})
    checks.append({"name": "Solar availability", "status": status(solar_ok),
                    "detail": "Solar used never exceeded available generation." if solar_ok
                    else "Solar used exceeded available generation at one or more steps."})
    checks.append({"name": "Grid import/export limits", "status": status(grid_ok),
                    "detail": "Grid import/export stayed within configured limits." if grid_ok
                    else "Grid import or export exceeded configured limits."})

    overall = "validated" if all(c["status"] == "validated" for c in checks) else "warning"
    return {"overall_status": overall, "checks": checks}


def summarize(scenario: Scenario, steps: List[Dict[str, Any]], ev_completion_fraction: float = None) -> Dict[str, Any]:
    dt = scenario.dt_hours
    total_cost = sum(s["cost"] for s in steps)
    total_emissions = sum(s["emissions_kg"] for s in steps)
    total_demand_kwh = sum(s["demand_kw"] for s in steps) * dt
    total_solar_used_kwh = sum(s["solar_used_kw"] for s in steps) * dt
    total_solar_gen_kwh = sum(s["solar_generation_kw"] for s in steps) * dt
    total_battery_discharge_kwh = sum(s["battery_discharge_kw"] for s in steps) * dt
    total_ev_kwh = sum(s["ev_charging_kw"] for s in steps) * dt
    total_grid_import_kwh = sum(s["grid_import_kw"] for s in steps) * dt
    total_grid_export_kwh = sum(s["grid_export_kw"] for s in steps) * dt
    peak_grid_import_kw = max((s["grid_import_kw"] for s in steps), default=0.0)
    battery_cycling_kwh = sum(s["battery_charge_kw"] + s["battery_discharge_kw"] for s in steps) * dt

    renewable_share = 0.0
    served = total_solar_used_kwh + total_battery_discharge_kwh
    total_served_energy = total_solar_used_kwh + total_battery_discharge_kwh + total_grid_import_kwh
    if total_served_energy > 0:
        renewable_share = (total_solar_used_kwh + total_battery_discharge_kwh) / total_served_energy

    if ev_completion_fraction is None:
        required = sum(s2["required_kwh"] for s2 in scenario.ev_required_kwh_by_step_window)
        ev_completion_fraction = 1.0 if required == 0 else min(1.0, total_ev_kwh / required)

    return {
        "total_cost": round(total_cost, 3),
        "total_emissions_kg": round(total_emissions, 3),
        "total_demand_kwh": round(total_demand_kwh, 3),
        "total_solar_generation_kwh": round(total_solar_gen_kwh, 3),
        "total_solar_used_kwh": round(total_solar_used_kwh, 3),
        "solar_curtailed_kwh": round(sum(s["solar_curtailed_kw"] for s in steps) * dt, 3),
        "total_battery_discharge_kwh": round(total_battery_discharge_kwh, 3),
        "total_ev_charged_kwh": round(total_ev_kwh, 3),
        "ev_completion_fraction": round(ev_completion_fraction, 4),
        "total_grid_import_kwh": round(total_grid_import_kwh, 3),
        "total_grid_export_kwh": round(total_grid_export_kwh, 3),
        "peak_grid_import_kw": round(peak_grid_import_kw, 3),
        "renewable_share": round(renewable_share, 4),
        "battery_cycling_kwh": round(battery_cycling_kwh, 3),
    }
