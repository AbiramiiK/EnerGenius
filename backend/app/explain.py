"""Explainable-AI recommendation cards generated directly from solver output.

No external LLM is used or required: every recommendation is derived from
actual optimized-schedule values and the configured constraints. This keeps
the explanations grounded and reproducible for the hackathon demo.
"""
from typing import List, Dict, Any
from app.engine import Scenario
from app.optimizer import STRATEGY_DESCRIPTIONS


def _find_periods(steps: List[Dict[str, Any]], predicate) -> List[List[Dict[str, Any]]]:
    periods = []
    current = []
    for s in steps:
        if predicate(s):
            current.append(s)
        else:
            if current:
                periods.append(current)
                current = []
    if current:
        periods.append(current)
    return periods


def generate_recommendations(scenario: Scenario, optimized_steps: List[Dict[str, Any]],
                              baseline_summary: Dict[str, Any], optimized_summary: Dict[str, Any],
                              strategy: str) -> List[Dict[str, Any]]:
    cards = []

    charge_periods = _find_periods(optimized_steps, lambda s: s["battery_charge_kw"] > 0.1)
    for p in charge_periods[:3]:
        start, end = p[0]["timestamp"], p[-1]["timestamp"]
        avg_kw = sum(s["battery_charge_kw"] for s in p) / len(p)
        surplus = any(s["solar_generation_kw"] > s["demand_kw"] for s in p)
        cards.append({
            "title": f"Charge battery {start}–{end}",
            "recommendation": f"Charge the battery at an average of {avg_kw:.1f} kW between {start} and {end}.",
            "why": ("Forecast solar generation exceeds campus demand in this window and the battery has available capacity."
                    if surplus else "The optimizer scheduled charging here to prepare for a later high-cost or high-demand period."),
            "inputs_considered": {
                "battery_max_charge_kw": scenario.battery_max_charge_kw,
                "battery_max_soc_pct": scenario.battery_max_soc_pct,
            },
            "constraints": ["Battery max charge power", "Battery max SOC"],
            "expected_effect": "Stores surplus/cheap energy for later use, reducing later grid import.",
            "trade_off": "Slightly increases battery cycling (a proxy for long-term degradation).",
            "uncertainty": "Depends on the accuracy of the solar/demand forecast for this window.",
        })

    discharge_periods = _find_periods(optimized_steps, lambda s: s["battery_discharge_kw"] > 0.1)
    for p in discharge_periods[:3]:
        start, end = p[0]["timestamp"], p[-1]["timestamp"]
        avg_kw = sum(s["battery_discharge_kw"] for s in p) / len(p)
        avg_tariff = sum(scenario.tariff_per_kwh[s["step_index"]] for s in p) / len(p)
        cards.append({
            "title": f"Discharge battery {start}–{end}",
            "recommendation": f"Discharge the battery at an average of {avg_kw:.1f} kW between {start} and {end}.",
            "why": f"This period has an effective tariff of {avg_tariff:.3f}/kWh and/or demand exceeding available solar; using stored energy avoids grid import here.",
            "inputs_considered": {"battery_max_discharge_kw": scenario.battery_max_discharge_kw},
            "constraints": ["Battery max discharge power", "Battery min SOC"],
            "expected_effect": "Reduces grid import (and associated cost/emissions) during this window.",
            "trade_off": "Draws down battery reserve, which may limit flexibility later in the day.",
            "uncertainty": "Assumes the demand forecast for this window holds.",
        })

    ev_periods = _find_periods(optimized_steps, lambda s: s["ev_charging_kw"] > 0.1)
    for p in ev_periods[:2]:
        start, end = p[0]["timestamp"], p[-1]["timestamp"]
        cards.append({
            "title": f"EV charging {start}–{end}",
            "recommendation": f"Charge EVs between {start} and {end}.",
            "why": "This window falls inside the vehicles' arrival/departure availability and aligns with lower-cost or higher-renewable supply.",
            "inputs_considered": {"ev_charger_power_kw": scenario.ev_charger_power_kw},
            "constraints": ["Charger power limit", "EV arrival/departure window", "Required energy per session"],
            "expected_effect": "Delivers the required EV energy while favoring cheaper/cleaner supply periods.",
            "trade_off": "May not always align with driver preference for immediate full-power charging.",
            "uncertainty": "Assumes EV arrival/departure times as configured were accurate.",
        })

    cost_delta = baseline_summary["total_cost"] - optimized_summary["total_cost"]
    emissions_delta = baseline_summary["total_emissions_kg"] - optimized_summary["total_emissions_kg"]
    cards.append({
        "title": f"Strategy: {strategy.replace('_', ' ').title()}",
        "recommendation": STRATEGY_DESCRIPTIONS.get(strategy, ""),
        "why": "This is the active optimization objective selected for this run.",
        "inputs_considered": {
            "baseline_cost": baseline_summary["total_cost"],
            "optimized_cost": optimized_summary["total_cost"],
            "baseline_emissions_kg": baseline_summary["total_emissions_kg"],
            "optimized_emissions_kg": optimized_summary["total_emissions_kg"],
        },
        "constraints": ["All physical and configured operating constraints"],
        "expected_effect": f"Versus the rule-based baseline: {cost_delta:+.2f} cost, {emissions_delta:+.2f} kg CO2 (positive = improvement).",
        "trade_off": "Optimizing for one objective (e.g. cost) may not minimize the others (e.g. emissions) simultaneously.",
        "uncertainty": "Both schedules use the same forecast inputs; real-world deviations will change actual outcomes.",
    })

    if not cards:
        cards.append({
            "title": "No significant battery/EV activity",
            "recommendation": "Grid and solar directly cover demand for this scenario.",
            "why": "The optimizer found no cost/emissions benefit to cycling the battery or shifting EV charging given current inputs.",
            "inputs_considered": {},
            "constraints": [],
            "expected_effect": "Schedule matches near-baseline behavior.",
            "trade_off": "None identified.",
            "uncertainty": "Re-run with different scenario inputs to explore alternatives.",
        })

    return cards
