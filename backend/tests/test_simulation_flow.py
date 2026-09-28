from tests.conftest import SAMPLE_PROFILE


def _setup(client):
    client.post("/api/site-profile", json=SAMPLE_PROFILE)
    client.post("/api/daily-inputs", json={"operating_date": "2026-01-01"})


def test_optimize_persists_run_and_results(client):
    _setup(client)
    resp = client.post("/api/optimize", json={"operating_date": "2026-01-01", "strategy": "cost_efficient"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["solver_status"] == "optimal"
    assert data["run_id"] is not None

    detail = client.get(f"/api/simulation-runs/{data['run_id']}")
    assert detail.status_code == 200
    assert len(detail.json()["steps"]) > 0


def test_simulate_does_not_persist(client):
    _setup(client)
    resp = client.post("/api/simulate", json={"operating_date": "2026-01-01", "strategy": "cost_efficient"})
    assert resp.status_code == 200
    assert resp.json()["run_id"] is None

    runs = client.get("/api/simulation-runs").json()
    assert len(runs) == 0


def test_scenario_override_triggers_different_backend_result(client):
    _setup(client)
    base = client.post("/api/simulate", json={
        "operating_date": "2026-01-01", "strategy": "cost_efficient",
    }).json()
    scaled = client.post("/api/simulate", json={
        "operating_date": "2026-01-01", "strategy": "cost_efficient",
        "scenario_overrides": {"demand_scale_factor": 2.0},
    }).json()
    assert base["optimized"]["summary"]["total_demand_kwh"] != scaled["optimized"]["summary"]["total_demand_kwh"]


def test_simulation_history_persists_across_runs(client):
    _setup(client)
    client.post("/api/optimize", json={"operating_date": "2026-01-01", "strategy": "cost_efficient"})
    client.post("/api/daily-inputs", json={"operating_date": "2026-01-02"})
    client.post("/api/optimize", json={"operating_date": "2026-01-02", "strategy": "more_sustainable"})

    runs = client.get("/api/simulation-runs").json()
    assert len(runs) == 2


def test_system_health_reflects_validated_schedule(client):
    _setup(client)
    run = client.post("/api/optimize", json={"operating_date": "2026-01-01", "strategy": "balanced"}).json()
    health = client.get(f"/api/system-health/{run['run_id']}")
    assert health.status_code == 200
    assert health.json()["overall_status"] == "validated"


def test_dashboard_kpis_match_backend_output_snapshot(client):
    _setup(client)
    run = client.post("/api/optimize", json={"operating_date": "2026-01-01", "strategy": "cost_efficient"}).json()
    listing = client.get("/api/simulation-runs").json()
    matching = next(r for r in listing if r["run_id"] == run["run_id"])
    assert matching["output_snapshot"]["optimized_summary"]["total_cost"] == run["optimized"]["summary"]["total_cost"]
