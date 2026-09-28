import os
import sys
import tempfile
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["ENERGENIUS_TEST_DB"] = "1"


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_file = tmp_path / "test.db"
    monkeypatch.setattr("app.database.DATABASE_URL", f"sqlite:///{db_file}")

    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    import app.database as database

    test_engine = create_engine(f"sqlite:///{db_file}", connect_args={"check_same_thread": False})
    TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    monkeypatch.setattr(database, "engine", test_engine)
    monkeypatch.setattr(database, "SessionLocal", TestSessionLocal)

    from app import models
    database.Base.metadata.create_all(bind=test_engine)

    from app.main import app
    from app.database import get_db

    def override_get_db():
        db = TestSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    from fastapi.testclient import TestClient
    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


SAMPLE_PROFILE = {
    "site_name": "Test Campus",
    "site_type": "campus",
    "timezone": "UTC",
    "time_step_minutes": 60,
    "solar_capacity_kw": 100.0,
    "battery_capacity_kwh": 200.0,
    "battery_initial_soc_pct": 50.0,
    "battery_min_soc_pct": 10.0,
    "battery_max_soc_pct": 95.0,
    "battery_max_charge_kw": 50.0,
    "battery_max_discharge_kw": 50.0,
    "typical_daily_demand_kwh": 800.0,
    "peak_demand_kw": 100.0,
    "ev_charger_count": 2,
    "ev_charger_power_kw": 11.0,
    "ev_default_energy_kwh": 20.0,
    "grid_max_import_kw": 150.0,
    "grid_max_export_kw": 20.0,
    "tariff_flat_rate": 0.2,
    "grid_carbon_intensity": 0.4,
    "default_strategy": "cost_efficient",
}
