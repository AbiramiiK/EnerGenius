"""Transparent rule-based baseline schedule, evaluated on the identical
scenario as the optimizer so the two can be fairly compared.

Rule: use solar to serve load first; charge the battery with any solar
surplus; discharge the battery to cover any deficit; charge EVs at full
charger power during their session window; the grid covers whatever is left.
"""
from typing import Dict, Any

from app.engine import Scenario

BASELINE_DESCRIPTION = (
    "Solar-first rule-based schedule: demand is served by solar first, then battery discharge, "
    "then grid import. Solar surplus charges the battery (up to its limits) before being curtailed "
    "or exported. EVs charge at full charger power for the duration of their session window, "
    "without price or forecast awareness."
)


def run_baseline(scenario: Scenario) -> Dict[str, Any]:
    n = scenario.n_steps
    dt = scenario.dt_hours
    cap_kwh = scenario.battery_capacity_kwh
    soc_min = cap_kwh * scenario.battery_min_soc_pct / 100.0
    soc_max = cap_kwh * scenario.battery_max_soc_pct / 100.0
    soc = cap_kwh * scenario.battery_initial_soc_pct / 100.0

    ev_remaining = {i: s["required_kwh"] for i, s in enumerate(scenario.ev_required_kwh_by_step_window)}

    steps = []
    for t in range(n):
        solar_avail = scenario.solar_avail_kw[t]
        demand = scenario.demand_kw[t]

        solar_used = min(solar_avail, demand)
        remaining_demand = demand - solar_used
        solar_surplus = solar_avail - solar_used

        # EV charging at full charger power, drawn independently of solar/grid choice
        ev_kw = 0.0
        for si, s in enumerate(scenario.ev_required_kwh_by_step_window):
            if s["start_step"] <= t < s["end_step"] and ev_remaining.get(si, 0) > 0:
                power = min(scenario.ev_charger_power_kw, ev_remaining[si] / dt)
                ev_kw += power
                ev_remaining[si] -= power * dt

        batt_charge = 0.0
        batt_discharge = 0.0

        if solar_surplus > 0:
            room_kwh = soc_max - soc
            max_charge_power = min(scenario.battery_max_charge_kw, room_kwh / (scenario.battery_charge_eff * dt) if dt > 0 else 0)
            batt_charge = max(0.0, min(solar_surplus, max_charge_power))
            solar_surplus -= batt_charge
        elif remaining_demand > 0:
            avail_kwh = soc - soc_min
            max_discharge_power = min(scenario.battery_max_discharge_kw, (avail_kwh * scenario.battery_discharge_eff) / dt if dt > 0 else 0)
            batt_discharge = max(0.0, min(remaining_demand, max_discharge_power))
            remaining_demand -= batt_discharge

        soc = soc + batt_charge * scenario.battery_charge_eff * dt - (batt_discharge / scenario.battery_discharge_eff) * dt
        soc = max(soc_min, min(soc_max, soc))

        grid_import = remaining_demand + ev_kw
        grid_export = min(solar_surplus, scenario.grid_max_export_kw)

        grid_import = min(grid_import, scenario.grid_max_import_kw) if scenario.grid_available else 0.0

        steps.append({
            "step_index": t,
            "timestamp": scenario.timestamps[t],
            "solar_generation_kw": round(solar_avail, 3),
            "solar_used_kw": round(solar_used, 3),
            "solar_curtailed_kw": round(max(0.0, solar_surplus - grid_export), 3),
            "demand_kw": round(demand, 3),
            "battery_charge_kw": round(batt_charge, 3),
            "battery_discharge_kw": round(batt_discharge, 3),
            "battery_soc_pct": round(100 * soc / cap_kwh, 2) if cap_kwh else 0,
            "ev_charging_kw": round(ev_kw, 3),
            "grid_import_kw": round(grid_import, 3),
            "grid_export_kw": round(grid_export, 3),
            "cost": round(grid_import * scenario.tariff_per_kwh[t] * dt - grid_export * scenario.tariff_per_kwh[t] * 0.5 * dt, 4),
            "emissions_kg": round(grid_import * scenario.carbon_intensity * dt, 4),
        })

    ev_completion = 1.0
    if ev_remaining:
        total_required = sum(s["required_kwh"] for s in scenario.ev_required_kwh_by_step_window)
        total_unmet = sum(max(0.0, v) for v in ev_remaining.values())
        ev_completion = 1.0 - (total_unmet / total_required if total_required > 0 else 0)

    return {
        "status": "optimal",
        "solver_message": "baseline rule-based schedule (not solver-optimized)",
        "steps": steps,
        "objective_value": None,
        "ev_completion_fraction": round(ev_completion, 4),
    }
