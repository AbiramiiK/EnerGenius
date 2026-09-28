"""Solar / demand forecasting.

Uses a historical-average baseline when uploaded history exists, a
RandomForest model when there is enough history to train and evaluate one,
or the site's configured typical-day shape when no history is available at
all (clearly labeled as such). Never fabricates accuracy metrics: MAE/RMSE
are only reported when computed from an actual holdout split.
"""
from typing import Dict, Any, Optional
import math
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error

from app.engine import _default_solar_shape, _default_demand_shape

MIN_ROWS_FOR_ML = 72  # at least 3 days of hourly-equivalent history


def _load_history(storage_path: str) -> Optional[pd.DataFrame]:
    try:
        if storage_path.endswith(".xlsx"):
            df = pd.read_excel(storage_path)
        else:
            df = pd.read_csv(storage_path)
        df.columns = [c.strip().lower() for c in df.columns]
        return df
    except Exception:
        return None


def forecast_series(target: str, n_steps: int, dt_minutes: int, capacity_or_total: float,
                     history_df: Optional[pd.DataFrame] = None,
                     value_col: Optional[str] = None,
                     timestamp_col: Optional[str] = None) -> Dict[str, Any]:
    if history_df is None or value_col is None or timestamp_col is None or len(history_df) < 8:
        shape = _default_solar_shape(n_steps) if target == "solar" else _default_demand_shape(n_steps)
        if target == "solar":
            values = [round(s * capacity_or_total, 3) for s in shape]
        else:
            dt_hours = dt_minutes / 60.0
            shape_sum = sum(shape) * dt_hours
            scale = capacity_or_total / shape_sum if shape_sum > 0 else 0
            values = [round(s * scale, 3) for s in shape]
        return {
            "method": "baseline_typical_shape",
            "status": "no_history",
            "values": values,
            "mae": None,
            "rmse": None,
            "notes": "No sufficient historical data was available; using the site's configured typical-day shape. This is a labeled estimate, not a data-driven forecast.",
        }

    df = history_df.copy()
    df[timestamp_col] = pd.to_datetime(df[timestamp_col])
    df["hour"] = df[timestamp_col].dt.hour + df[timestamp_col].dt.minute / 60.0
    df["dow"] = df[timestamp_col].dt.dayofweek

    if len(df) < MIN_ROWS_FOR_ML:
        hourly_avg = df.groupby("hour")[value_col].mean()
        step_hours = [i * dt_minutes / 60.0 for i in range(n_steps)]
        values = [round(float(hourly_avg.get(min(hourly_avg.index, key=lambda h: abs(h - hh)), 0)), 3) for hh in step_hours]
        return {
            "method": "historical_average",
            "status": "limited_history",
            "values": values,
            "mae": None,
            "rmse": None,
            "notes": f"Only {len(df)} historical records available (need {MIN_ROWS_FOR_ML}+ to train a model); using an hour-of-day historical average instead.",
        }

    X = df[["hour", "dow"]].values
    y = df[value_col].values
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    model = RandomForestRegressor(n_estimators=100, random_state=42, max_depth=8)
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    mae = float(mean_absolute_error(y_test, y_pred))
    rmse = float(math.sqrt(mean_squared_error(y_test, y_pred)))

    step_hours = np.array([[i * dt_minutes / 60.0, pd.Timestamp.now().dayofweek] for i in range(n_steps)])
    preds = model.predict(step_hours)
    values = [round(max(0.0, float(v)), 3) for v in preds]

    return {
        "method": "random_forest",
        "status": "trained",
        "values": values,
        "mae": round(mae, 3),
        "rmse": round(rmse, 3),
        "notes": f"RandomForest trained on {len(X_train)} records, evaluated on a {len(X_test)}-record holdout split.",
    }
