from tests.conftest import SAMPLE_PROFILE


def test_daily_input_requires_site_profile(client):
    resp = client.post("/api/daily-inputs", json={"operating_date": "2026-01-01"})
    assert resp.status_code == 404


def test_daily_input_create_and_fetch(client):
    client.post("/api/site-profile", json=SAMPLE_PROFILE)
    payload = {
        "operating_date": "2026-01-01",
        "starting_battery_soc_pct": 60.0,
        "demand_source": "user-entered",
        "solar_source": "estimated",
        "ev_sessions": [{"charger_id": "EV-1", "arrival": "09:00", "departure": "17:00", "required_kwh": 15}],
    }
    resp = client.post("/api/daily-inputs", json=payload)
    assert resp.status_code == 200
    assert resp.json()["starting_battery_soc_pct"] == 60.0

    resp2 = client.get("/api/daily-inputs/2026-01-01")
    assert resp2.status_code == 200
    assert resp2.json()["ev_sessions"][0]["charger_id"] == "EV-1"


def test_daily_input_does_not_overwrite_other_dates(client):
    client.post("/api/site-profile", json=SAMPLE_PROFILE)
    client.post("/api/daily-inputs", json={"operating_date": "2026-01-01", "notes": "day1"})
    client.post("/api/daily-inputs", json={"operating_date": "2026-01-02", "notes": "day2"})

    d1 = client.get("/api/daily-inputs/2026-01-01").json()
    d2 = client.get("/api/daily-inputs/2026-01-02").json()
    assert d1["notes"] == "day1"
    assert d2["notes"] == "day2"
