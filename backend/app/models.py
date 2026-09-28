import uuid
from datetime import datetime, date as date_type

from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Date, JSON, ForeignKey, Text
)
from sqlalchemy.orm import relationship

from app.database import Base


def gen_id() -> str:
    return uuid.uuid4().hex[:12]


class SiteProfile(Base):
    __tablename__ = "site_profiles"

    site_id = Column(String, primary_key=True, default=gen_id)
    site_name = Column(String, nullable=False)
    site_type = Column(String, nullable=False)
    timezone = Column(String, nullable=False, default="UTC")
    operating_days = Column(JSON, default=list)
    operating_hours = Column(JSON, default=dict)  # {"start": "08:00", "end": "18:00"}
    time_step_minutes = Column(Integer, default=60)

    # Solar
    solar_capacity_kw = Column(Float, nullable=False)
    solar_inverter_limit_kw = Column(Float, nullable=True)
    solar_notes = Column(Text, nullable=True)
    solar_has_history = Column(Boolean, default=False)

    # Battery
    battery_capacity_kwh = Column(Float, nullable=False)
    battery_initial_soc_pct = Column(Float, default=50.0)
    battery_min_soc_pct = Column(Float, default=10.0)
    battery_max_soc_pct = Column(Float, default=95.0)
    battery_max_charge_kw = Column(Float, nullable=False)
    battery_max_discharge_kw = Column(Float, nullable=False)
    battery_charge_efficiency = Column(Float, default=0.95)
    battery_discharge_efficiency = Column(Float, default=0.95)

    # Demand
    typical_daily_demand_kwh = Column(Float, nullable=True)
    peak_demand_kw = Column(Float, nullable=True)
    essential_load_kw = Column(Float, nullable=True)
    demand_has_history = Column(Boolean, default=False)

    # EV
    ev_charger_count = Column(Integer, default=0)
    ev_charger_power_kw = Column(Float, default=7.0)
    ev_default_window_start = Column(String, default="09:00")
    ev_default_window_end = Column(String, default="17:00")
    ev_default_energy_kwh = Column(Float, default=20.0)
    ev_has_history = Column(Boolean, default=False)

    # Grid
    grid_max_import_kw = Column(Float, nullable=False)
    grid_max_export_kw = Column(Float, default=0.0)
    tariff_flat_rate = Column(Float, default=0.15)  # currency per kWh
    tariff_schedule = Column(JSON, nullable=True)  # list of {start,end,rate}
    grid_carbon_intensity = Column(Float, default=0.45)  # kg CO2 per kWh
    grid_available = Column(Boolean, default=True)

    # Optimization preferences
    default_strategy = Column(String, default="cost_efficient")
    cost_weight = Column(Float, default=0.5)
    emissions_weight = Column(Float, default=0.3)
    battery_weight = Column(Float, default=0.2)

    profile_version = Column(Integer, default=1)
    is_demo = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DailyInput(Base):
    __tablename__ = "daily_inputs"

    daily_input_id = Column(String, primary_key=True, default=gen_id)
    site_id = Column(String, ForeignKey("site_profiles.site_id"), nullable=False)
    operating_date = Column(Date, nullable=False)

    starting_battery_soc_pct = Column(Float, nullable=True)
    demand_profile = Column(JSON, nullable=True)  # list of kW per timestep, user/derived
    demand_source = Column(String, default="estimated")  # measured/user-entered/forecast/estimated/synthetic

    solar_profile = Column(JSON, nullable=True)
    solar_source = Column(String, default="estimated")

    ev_sessions = Column(JSON, default=list)  # [{charger_id, arrival, departure, required_kwh}]

    tariff_override = Column(Float, nullable=True)
    grid_restricted = Column(Boolean, default=False)
    grid_restricted_limit_kw = Column(Float, nullable=True)

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)


class UploadedDataset(Base):
    __tablename__ = "uploaded_datasets"

    dataset_id = Column(String, primary_key=True, default=gen_id)
    site_id = Column(String, ForeignKey("site_profiles.site_id"), nullable=False)
    filename = Column(String, nullable=False)
    kind = Column(String, nullable=False)  # demand / solar / ev
    row_count = Column(Integer, default=0)
    columns = Column(JSON, default=list)
    warnings = Column(JSON, default=list)
    storage_path = Column(String, nullable=False)
    uploaded_at = Column(DateTime, default=datetime.utcnow)


class SimulationRun(Base):
    __tablename__ = "simulation_runs"

    run_id = Column(String, primary_key=True, default=gen_id)
    site_id = Column(String, ForeignKey("site_profiles.site_id"), nullable=False)
    operating_date = Column(Date, nullable=False)
    profile_version = Column(Integer, nullable=False)
    strategy = Column(String, nullable=False)
    scenario_params = Column(JSON, default=dict)
    solver_status = Column(String, nullable=False)  # optimal/infeasible/error
    objective_value = Column(Float, nullable=True)
    input_snapshot = Column(JSON, nullable=True)
    output_snapshot = Column(JSON, nullable=True)  # summary KPIs + baseline comparison
    created_at = Column(DateTime, default=datetime.utcnow)

    results = relationship("SimulationResult", back_populates="run", cascade="all, delete-orphan")


class SimulationResult(Base):
    __tablename__ = "simulation_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String, ForeignKey("simulation_runs.run_id"), nullable=False)
    timestamp = Column(String, nullable=False)  # HH:MM label
    step_index = Column(Integer, nullable=False)

    solar_generation_kw = Column(Float, default=0.0)
    solar_used_kw = Column(Float, default=0.0)
    solar_curtailed_kw = Column(Float, default=0.0)
    demand_kw = Column(Float, default=0.0)
    battery_charge_kw = Column(Float, default=0.0)
    battery_discharge_kw = Column(Float, default=0.0)
    battery_soc_pct = Column(Float, default=0.0)
    ev_charging_kw = Column(Float, default=0.0)
    grid_import_kw = Column(Float, default=0.0)
    grid_export_kw = Column(Float, default=0.0)
    cost = Column(Float, default=0.0)
    emissions_kg = Column(Float, default=0.0)
    validation_status = Column(String, default="not_evaluated")

    run = relationship("SimulationRun", back_populates="results")
