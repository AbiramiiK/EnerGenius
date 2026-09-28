import pandas as pd
from app.upload_validation import validate_dataset


def test_missing_required_column_is_rejected():
    df = pd.DataFrame({"timestamp": ["2026-01-01 00:00"], "wrong_col": [1.0]})
    result = validate_dataset(df, "demand")
    assert result["valid"] is False
    assert "demand_kw" in result["errors"][0]


def test_bad_timestamps_and_negative_values_are_dropped_with_warning():
    df = pd.DataFrame({
        "timestamp": ["2026-01-01 00:00", "not-a-date", "2026-01-01 02:00"],
        "demand_kw": [10.0, 20.0, -5.0],
    })
    result = validate_dataset(df, "demand")
    assert result["valid"] is True
    assert result["row_count"] == 1
    assert any("unparseable timestamps" in w for w in result["warnings"])
    assert any("negative" in w for w in result["warnings"])


def test_duplicate_timestamps_are_deduplicated():
    df = pd.DataFrame({
        "timestamp": ["2026-01-01 00:00", "2026-01-01 00:00"],
        "demand_kw": [10.0, 15.0],
    })
    result = validate_dataset(df, "demand")
    assert result["row_count"] == 1
    assert any("duplicate" in w for w in result["warnings"])


def test_ev_dataset_rejects_departure_before_arrival():
    df = pd.DataFrame({
        "arrival": ["2026-01-01 09:00"],
        "departure": ["2026-01-01 08:00"],
        "required_kwh": [10.0],
    })
    result = validate_dataset(df, "ev")
    assert result["row_count"] == 0
    assert any("departure at or before arrival" in w for w in result["warnings"])
