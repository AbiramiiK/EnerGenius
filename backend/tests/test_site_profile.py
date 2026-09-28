from tests.conftest import SAMPLE_PROFILE


def test_create_and_persist_site_profile(client):
    resp = client.post("/api/site-profile", json=SAMPLE_PROFILE)
    assert resp.status_code == 200
    data = resp.json()
    assert data["site_name"] == "Test Campus"
    assert data["profile_version"] == 1

    resp2 = client.get("/api/site-profile")
    assert resp2.status_code == 200
    assert resp2.json()["site_id"] == data["site_id"]


def test_get_site_profile_404_when_not_configured(client):
    resp = client.get("/api/site-profile")
    assert resp.status_code == 404


def test_update_site_profile_increments_version(client):
    created = client.post("/api/site-profile", json=SAMPLE_PROFILE).json()
    updated_payload = dict(SAMPLE_PROFILE)
    updated_payload["site_name"] = "Renamed Campus"
    resp = client.put(f"/api/site-profile/{created['site_id']}", json=updated_payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["site_name"] == "Renamed Campus"
    assert data["profile_version"] == 2


def test_reload_after_restart_simulation(client):
    """A second GET (simulating a fresh page load) must still return the saved profile."""
    client.post("/api/site-profile", json=SAMPLE_PROFILE)
    resp = client.get("/api/site-profile")
    assert resp.status_code == 200
    assert resp.json()["site_name"] == "Test Campus"
