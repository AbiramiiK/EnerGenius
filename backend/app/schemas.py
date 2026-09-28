from datetime import date, datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict


class SiteProfileIn(BaseModel):
    site_name: str
    site_type: str = "campus"
    timezone: str = "UTC"
    operating_days: List[str] = Field(default_factory=lambda: ["Mon", "Tue", "Wed", "Thu", "Fri"])
    operating_hours: Dict[str, str] = Field(default_factory=lambda: {"start": "08:00", "end": "18:00"})
    time_step_minutes: int = 60

    solar_capacity_kw: float
    solar_inverter_limit_kw: Optional[float] = None
    solar_notes: Optional[str] = None
    solar_has_history: bool = False

    battery_capacity_kwh: float
    battery_initial_soc_pct: float = 50.0
    battery_min_soc_pct: float = 10.0
    battery_max_soc_pct: float = 95.0
    battery_max_charge_kw: float
    battery_max_discharge_kw: float
    battery_charge_efficiency: float = 0.95
    battery_discharge_efficiency: float = 0.95

    typical_daily_demand_kwh: Optional[float] = None
    peak_demand_kw: Optional[float] = None
    essential_load_kw: Optional[float] = None
    demand_has_history: bool = False

    ev_charger_count: int = 0
    ev_charger_power_kw: float = 7.0
    ev_default_window_start: str = "09:00"
    ev_default_window_end: str = "17:00"
    ev_default_energy_kwh: float = 20.0
    ev_has_history: bool = False

    grid_max_import_kw: float
    grid_max_export_kw: float = 0.0
    tariff_flat_rate: float = 0.15
    tariff_schedule: Optional[List[Dict[str, Any]]] = None
    grid_carbon_intensity: float = 0.45
    grid_available: bool = True

    default_strategy: str = "cost_efficient"
    cost_weight: float = 0.5
    emissions_weight: float = 0.3
    battery_weight: float = 0.2

    is_demo: bool = False


class SiteProfileOut(SiteProfileIn):
    model_config = ConfigDict(from_attributes=True)
    site_id: str
    profile_version: int
    created_at: datetime
    updated_at: datetime


class DailyInputIn(BaseModel):
    operating_date: date
    starting_battery_soc_pct: Optional[float] = None
    demand_profile: Optional[List[float]] = None
    demand_source: str = "estimated"
    solar_profile: Optional[List[float]] = None
    solar_source: str = "estimated"
    ev_sessions: List[Dict[str, Any]] = Field(default_factory=list)
    tariff_override: Optional[float] = None
    grid_restricted: bool = False
    grid_restricted_limit_kw: Optional[float] = None
    notes: Optional[str] = None


class DailyInputOut(DailyInputIn):
    model_config = ConfigDict(from_attributes=True)
    daily_input_id: str
    site_id: str
    created_at: datetime


class OptimizeRequest(BaseModel):
    operating_date: date
    strategy: str = "cost_efficient"
    scenario_overrides: Optional[Dict[str, Any]] = None  # for Scenario Lab sliders


class ForecastRequest(BaseModel):
    target: str  # "solar" or "demand"
    operating_date: date
    horizon_steps: Optional[int] = None
