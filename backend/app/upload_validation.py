"""CSV/Excel upload validation for historical demand/solar/EV datasets."""
from typing import Dict, Any, List
import pandas as pd

REQUIRED_COLUMNS = {
    "demand": ["timestamp", "demand_kw"],
    "solar": ["timestamp", "solar_kw"],
    "ev": ["arrival", "departure", "required_kwh"],
}

VALUE_COLUMNS = {
    "demand": "demand_kw",
    "solar": "solar_kw",
}


def load_dataframe(path: str) -> pd.DataFrame:
    if path.lower().endswith((".xlsx", ".xls")):
        return pd.read_excel(path)
    return pd.read_csv(path)


def validate_dataset(df: pd.DataFrame, kind: str) -> Dict[str, Any]:
    warnings: List[str] = []
    errors: List[str] = []

    required = REQUIRED_COLUMNS.get(kind, [])
    df.columns = [c.strip().lower() for c in df.columns]
    missing_cols = [c for c in required if c not in df.columns]
    if missing_cols:
        errors.append(f"Missing required column(s): {', '.join(missing_cols)}")
        return {"valid": False, "errors": errors, "warnings": warnings, "row_count": len(df), "columns": list(df.columns)}

    df = df.copy()

    if kind in ("demand", "solar"):
        value_col = VALUE_COLUMNS[kind]
        before = len(df)
        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
        n_bad_ts = df["timestamp"].isna().sum()
        if n_bad_ts:
            warnings.append(f"{n_bad_ts} row(s) had unparseable timestamps and were dropped.")
            df = df.dropna(subset=["timestamp"])

        df[value_col] = pd.to_numeric(df[value_col], errors="coerce")
        n_bad_val = df[value_col].isna().sum()
        if n_bad_val:
            warnings.append(f"{n_bad_val} row(s) had non-numeric {value_col} values and were dropped.")
            df = df.dropna(subset=[value_col])

        n_negative = (df[value_col] < 0).sum()
        if n_negative:
            warnings.append(f"{n_negative} row(s) had negative {value_col} values and were dropped.")
            df = df[df[value_col] >= 0]

        dup = df.duplicated(subset=["timestamp"]).sum()
        if dup:
            warnings.append(f"{dup} duplicate timestamp row(s) were dropped, keeping the first occurrence.")
            df = df.drop_duplicates(subset=["timestamp"], keep="first")

        if len(df) == 0:
            errors.append("No valid rows remained after validation.")
        elif before - len(df) > 0 and len(df) < before * 0.5:
            warnings.append("More than half of the uploaded rows were invalid; forecast quality may be limited.")

    elif kind == "ev":
        df["arrival"] = pd.to_datetime(df["arrival"], errors="coerce")
        df["departure"] = pd.to_datetime(df["departure"], errors="coerce")
        df["required_kwh"] = pd.to_numeric(df["required_kwh"], errors="coerce")
        bad = df[["arrival", "departure", "required_kwh"]].isna().any(axis=1).sum()
        if bad:
            warnings.append(f"{bad} row(s) had missing/invalid arrival, departure, or required_kwh and were dropped.")
            df = df.dropna(subset=["arrival", "departure", "required_kwh"])
        invalid_order = (df["departure"] <= df["arrival"]).sum()
        if invalid_order:
            warnings.append(f"{invalid_order} row(s) had departure at or before arrival and were dropped.")
            df = df[df["departure"] > df["arrival"]]

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "warnings": warnings,
        "row_count": len(df),
        "columns": list(df.columns),
        "dataframe": df,
    }
