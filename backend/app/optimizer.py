"""Constrained energy optimization engine built on PuLP (CBC solver).

Decision variables per time step: solar used, battery charge/discharge,
battery SOC, per-EV-session charging power, grid import/export.
Strategy selection changes the LP objective function, not just a label.
"""
from typing import Dict, Any, List
import pulp

from app.engine import Scenario

STRATEGIES = ["cost_efficient", "more_sustainable", "balanced", "reliability_first"]

STRATEGY_DESCRIPTIONS = {
    "cost_efficient": "Minimizes total electricity cost from grid import, net of any export credit, using the configured tariff.",
    "more_sustainable": "Minimizes operational CO2 emissions attributable to grid import, using the configured grid carbon intensity.",
    "balanced": "Minimizes a weighted sum of cost, emissions, and battery-use (a degradation proxy), using the site's configured weights.",
    "reliability_first": "Maximizes end-of-day battery reserve (resilience against outages) while remaining cost-aware as a secondary objective. Note: per-device essential-load metering is not implemented in this prototype; this is a system-level reliability proxy, not a guarantee of specific critical-load uptime.",
}


def run_optimization(scenario: Scenario, strategy: str, weights: Dict[str, float] = None) -> Dict[str, Any]:
    weights = weights or {}
    n = scenario.n_steps
    dt = scenario.dt_hours
    cap_kwh = scenario.battery_capacity_kwh
    soc_min = cap_kwh * scenario.battery_min_soc_pct / 100.0
    soc_max = cap_kwh * scenario.battery_max_soc_pct / 100.0
    soc0 = cap_kwh * scenario.battery_initial_soc_pct / 100.0

    prob = pulp.LpProblem("energenius_optimization", pulp.LpMinimize)

    solar_used = [pulp.LpVariable(f"solar_used_{t}", 0, scenario.solar_avail_kw[t]) for t in range(n)]
    batt_charge = [pulp.LpVariable(f"batt_charge_{t}", 0, scenario.battery_max_charge_kw) for t in range(n)]
    batt_discharge = [pulp.LpVariable(f"batt_discharge_{t}", 0, scenario.battery_max_discharge_kw) for t in range(n)]
    soc = [pulp.LpVariable(f"soc_{t}", soc_min, soc_max) for t in range(n)]
    grid_import_max = scenario.grid_max_import_kw if scenario.grid_available else 0.0
    grid_import = [pulp.LpVariable(f"grid_import_{t}", 0, grid_import_max) for t in range(n)]
    grid_export = [pulp.LpVariable(f"grid_export_{t}", 0, scenario.grid_max_export_kw) for t in range(n)]

    ev_sessions = scenario.ev_required_kwh_by_step_window
    ev_vars: List[Dict[int, pulp.LpVariable]] = []
    for si, s in enumerate(ev_sessions):
        vars_for_session = {}
        for t in range(s["start_step"], s["end_step"]):
            vars_for_session[t] = pulp.LpVariable(f"ev_{si}_{t}", 0, scenario.ev_charger_power_kw)
        ev_vars.append(vars_for_session)

    def ev_charge_at(t):
        total = 0
        for vars_for_session in ev_vars:
            if t in vars_for_session:
                total += vars_for_session[t]
        return total

    # Energy balance
    for t in range(n):
        prob += (
            solar_used[t] + batt_discharge[t] + grid_import[t]
            == scenario.demand_kw[t] + batt_charge[t] + ev_charge_at(t) + grid_export[t]
        ), f"balance_{t}"

    # SOC dynamics
    for t in range(n):
        prev = soc0 if t == 0 else soc[t - 1]
        prob += (
            soc[t] == prev
            + batt_charge[t] * scenario.battery_charge_eff * dt
            - batt_discharge[t] * (1.0 / scenario.battery_discharge_eff) * dt
        ), f"soc_{t}"

    # EV energy requirement per session (hard constraint -> infeasible if unattainable)
    for si, s in enumerate(ev_sessions):
        vars_for_session = ev_vars[si]
        prob += pulp.lpSum(v * dt for v in vars_for_session.values()) >= s["required_kwh"], f"ev_energy_{si}"

    total_cost = pulp.lpSum(
        grid_import[t] * scenario.tariff_per_kwh[t] * dt - grid_export[t] * scenario.tariff_per_kwh[t] * 0.5 * dt
        for t in range(n)
    )
    total_emissions = pulp.lpSum(grid_import[t] * scenario.carbon_intensity * dt for t in range(n))
    battery_use = pulp.lpSum((batt_charge[t] + batt_discharge[t]) * dt for t in range(n))

    if strategy == "cost_efficient":
        prob += total_cost
    elif strategy == "more_sustainable":
        prob += total_emissions
    elif strategy == "balanced":
        cw = weights.get("cost_weight", 0.5)
        ew = weights.get("emissions_weight", 0.3)
        bw = weights.get("battery_weight", 0.2)
        prob += cw * total_cost + ew * total_emissions + bw * battery_use
    elif strategy == "reliability_first":
        prob += -soc[n - 1] * 1000 + total_cost * 0.01
    else:
        raise ValueError(f"Unknown strategy: {strategy}")

    solver = pulp.PULP_CBC_CMD(msg=False)
    prob.solve(solver)
    status = pulp.LpStatus[prob.status]

    if status != "Optimal":
        return {
            "status": "infeasible" if status == "Infeasible" else "error",
            "solver_message": status,
            "steps": [],
            "objective_value": None,
        }

    steps = []
    for t in range(n):
        ev_kw = sum(v.value() or 0 for vfs in ev_vars for tt, v in vfs.items() if tt == t)
        steps.append({
            "step_index": t,
            "timestamp": scenario.timestamps[t],
            "solar_generation_kw": round(scenario.solar_avail_kw[t], 3),
            "solar_used_kw": round(solar_used[t].value() or 0, 3),
            "solar_curtailed_kw": round(max(0.0, scenario.solar_avail_kw[t] - (solar_used[t].value() or 0)), 3),
            "demand_kw": round(scenario.demand_kw[t], 3),
            "battery_charge_kw": round(batt_charge[t].value() or 0, 3),
            "battery_discharge_kw": round(batt_discharge[t].value() or 0, 3),
            "battery_soc_pct": round(100 * (soc[t].value() or 0) / cap_kwh, 2) if cap_kwh else 0,
            "ev_charging_kw": round(ev_kw, 3),
            "grid_import_kw": round(grid_import[t].value() or 0, 3),
            "grid_export_kw": round(grid_export[t].value() or 0, 3),
            "cost": round((grid_import[t].value() or 0) * scenario.tariff_per_kwh[t] * dt
                          - (grid_export[t].value() or 0) * scenario.tariff_per_kwh[t] * 0.5 * dt, 4),
            "emissions_kg": round((grid_import[t].value() or 0) * scenario.carbon_intensity * dt, 4),
        })

    return {
        "status": "optimal",
        "solver_message": status,
        "steps": steps,
        "objective_value": pulp.value(prob.objective),
    }
