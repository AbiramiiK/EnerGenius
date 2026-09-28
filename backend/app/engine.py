"""Shared scenario preparation used by both the optimizer and the baseline schedule.

Builds per-timestep arrays (solar availability, demand, tariff, EV charger
availability) from a SiteProfile + DailyInput (+ optional Scenario Lab
overrides) so that the optimized and baseline schedules are evaluated against
an identical scenario.
"""
import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional


@dataclass
class Scenario:
    n_steps: int
    dt_hours: float
    timestamps: List[str]
    solar_avail_kw: List[float]
    demand_kw: List[float]
    tariff_per_kwh: List[float]
    carbon_intensity: float
    grid_max_import_kw: float
    grid_max_export_kw: float
    battery_capacity_kwh: float
    battery_min_soc_pct: float
    battery_max_soc_pct: float
    battery_initial_soc_pct: float
    battery_max_charge_kw: float
    battery_max_discharge_kw: float
    battery_charge_eff: float
    battery_discharge_eff: float
    ev_available_kw: List[float]  # total EV charger power available at each step
    ev_required_kwh_by_step_window: List[Dict[str, Any]]  # sessions with step indices
    ev_charger_power_kw: float = 7.0
    grid_available: bool = True
    solar_labeled_synthetic: bool = False
    demand_labeled_synthetic: bool = False


def _default_solar_shape(n_steps: int) -> List[float]:
    """Bell-shaped solar profile peaking at solar noon, zero at night."""
    shape = []
    for i in range(n_steps):
        frac = i / max(n_steps - 1, 1)
        hour = frac * 24
        if 6 <= hour <= 18:
            shape.append(max(0.0, math.sin(math.pi * (hour - 6) / 12)))
        else:
            shape.append(0.0)
    return shape


def _default_demand_shape(n_steps: int) -> List[float]:
    """Two-peak (morning/evening) demand shape typical of a campus/building."""
    shape = []
    for i in range(n_steps):
        frac = i / max(n_steps - 1, 1)
        hour = frac * 24
        base = 0.35
        morning = 0.5 * math.exp(-((hour - 9.5) ** 2) / (2 * 2.0 ** 2))
        evening = 0.65 * math.exp(-((hour - 19) ** 2) / (2 * 2.5 ** 2))
        shape.append(base + morning + evening)
    return shape


def build_scenario(site, daily_input: Optional[object], overrides: Optional[Dict[str, Any]] = None) -> Scenario:
    overrides = overrides or {}
    dt_minutes = site.time_step_minutes or 60
    n_steps = int(24 * 60 / dt_minutes)
    dt_hours = dt_minutes / 60.0
    timestamps = []
    for i in range(n_steps):
        total_min = i * dt_minutes
        h = (total_min // 60) % 24
        m = total_min % 60
        timestamps.append(f"{h:02d}:{m:02d}")

    solar_labeled_synthetic = False
    demand_labeled_synthetic = False

    # Solar profile
    if daily_input is not None and daily_input.solar_profile and len(daily_input.solar_profile) == n_steps:
        solar_avail = list(daily_input.solar_profile)
    else:
        shape = _default_solar_shape(n_steps)
        peak = overrides.get("solar_capacity_kw", site.solar_capacity_kw)
        solar_avail = [round(s * peak, 3) for s in shape]
        solar_labeled_synthetic = True

    if "solar_availability_factor" in overrides:
        f = overrides["solar_availability_factor"]
        solar_avail = [round(s * f, 3) for s in solar_avail]

    if site.solar_inverter_limit_kw:
        solar_avail = [min(s, site.solar_inverter_limit_kw) for s in solar_avail]

    # Demand profile
    if daily_input is not None and daily_input.demand_profile and len(daily_input.demand_profile) == n_steps:
        demand = list(daily_input.demand_profile)
    else:
        shape = _default_demand_shape(n_steps)
        total_kwh = overrides.get(
            "demand_total_kwh",
            site.typical_daily_demand_kwh or (site.peak_demand_kw or 50) * 10,
        )
        shape_sum = sum(shape) * dt_hours
        scale = total_kwh / shape_sum if shape_sum > 0 else 0
        demand = [round(s * scale, 3) for s in shape]
        demand_labeled_synthetic = True

    if "demand_scale_factor" in overrides:
        f = overrides["demand_scale_factor"]
        demand = [round(d * f, 3) for d in demand]

    # Tariff
    tariff_flat = overrides.get("tariff_flat_rate", daily_input.tariff_override if daily_input and daily_input.tariff_override else site.tariff_flat_rate)
    tariff = [tariff_flat] * n_steps
    if site.tariff_schedule:
        for i, ts in enumerate(timestamps):
            for band in site.tariff_schedule:
                if band["start"] <= ts < band["end"]:
                    tariff[i] = band["rate"]

    # Grid limits
    grid_max_import = overrides.get("grid_max_import_kw", site.grid_max_import_kw)
    if daily_input is not None and daily_input.grid_restricted and daily_input.grid_restricted_limit_kw is not None:
        grid_max_import = min(grid_max_import, daily_input.grid_restricted_limit_kw)
    grid_max_export = overrides.get("grid_max_export_kw", site.grid_max_export_kw or 0.0)
    grid_available = site.grid_available and not (daily_input.grid_restricted if daily_input else False and daily_input.grid_restricted_limit_kw == 0)

    # EV sessions -> per-step available charger power + energy requirements
    ev_count = overrides.get("ev_charger_count", site.ev_charger_count)
    charger_power = site.ev_charger_power_kw
    sessions = (daily_input.ev_sessions if daily_input and daily_input.ev_sessions else [])
    if not sessions and ev_count > 0:
        sessions = [{
            "charger_id": f"EV-{i+1}",
            "arrival": site.ev_default_window_start,
            "departure": site.ev_default_window_end,
            "required_kwh": overrides.get("ev_required_kwh", site.ev_default_energy_kwh),
        } for i in range(ev_count)]
    if "ev_count_override" in overrides:
        n = overrides["ev_count_override"]
        base = sessions[0] if sessions else {
            "arrival": site.ev_default_window_start,
            "departure": site.ev_default_window_end,
            "required_kwh": site.ev_default_energy_kwh,
        }
        sessions = [{**base, "charger_id": f"EV-{i+1}"} for i in range(n)]

    def time_to_step(t: str) -> int:
        h, m = map(int, t.split(":"))
        return int((h * 60 + m) / dt_minutes)

    ev_available_kw = [0.0] * n_steps
    ev_sessions_resolved = []
    for s in sessions:
        start_step = min(time_to_step(s["arrival"]), n_steps - 1)
        end_step = min(time_to_step(s["departure"]), n_steps)
        if end_step <= start_step:
            end_step = min(start_step + 1, n_steps)
        for i in range(start_step, end_step):
            ev_available_kw[i] += charger_power
        ev_sessions_resolved.append({
            "charger_id": s.get("charger_id", "EV"),
            "start_step": start_step,
            "end_step": end_step,
            "required_kwh": s.get("required_kwh", site.ev_default_energy_kwh),
        })

    return Scenario(
        n_steps=n_steps,
        dt_hours=dt_hours,
        timestamps=timestamps,
        solar_avail_kw=solar_avail,
        demand_kw=demand,
        tariff_per_kwh=tariff,
        carbon_intensity=overrides.get("grid_carbon_intensity", site.grid_carbon_intensity),
        grid_max_import_kw=grid_max_import,
        grid_max_export_kw=grid_max_export,
        battery_capacity_kwh=overrides.get("battery_capacity_kwh", site.battery_capacity_kwh),
        battery_min_soc_pct=site.battery_min_soc_pct,
        battery_max_soc_pct=site.battery_max_soc_pct,
        battery_initial_soc_pct=overrides.get(
            "battery_initial_soc_pct",
            (daily_input.starting_battery_soc_pct if daily_input and daily_input.starting_battery_soc_pct is not None else site.battery_initial_soc_pct),
        ),
        battery_max_charge_kw=site.battery_max_charge_kw,
        battery_max_discharge_kw=site.battery_max_discharge_kw,
        battery_charge_eff=site.battery_charge_efficiency,
        battery_discharge_eff=site.battery_discharge_efficiency,
        ev_available_kw=ev_available_kw,
        ev_required_kwh_by_step_window=ev_sessions_resolved,
        ev_charger_power_kw=charger_power,
        grid_available=grid_available,
        solar_labeled_synthetic=solar_labeled_synthetic,
        demand_labeled_synthetic=demand_labeled_synthetic,
    )
