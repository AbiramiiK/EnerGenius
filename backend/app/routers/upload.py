import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app import models
from app.upload_validation import load_dataframe, validate_dataset

router = APIRouter(prefix="/api/data", tags=["data"])

STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(STORAGE_DIR, exist_ok=True)

MAX_SIZE_MB = 10


@router.post("/upload")
async def upload_dataset(kind: str = Form(...), file: UploadFile = File(...), db: Session = Depends(get_db)):
    if kind not in ("demand", "solar", "ev"):
        raise HTTPException(status_code=400, detail="kind must be one of demand, solar, ev")

    site = db.query(models.SiteProfile).first()
    if not site:
        raise HTTPException(status_code=404, detail="No site profile configured yet.")

    if not file.filename.lower().endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only .csv and .xlsx files are supported.")

    contents = await file.read()
    if len(contents) > MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File exceeds {MAX_SIZE_MB}MB limit.")

    dest_path = os.path.join(STORAGE_DIR, f"{site.site_id}_{kind}_{file.filename}")
    with open(dest_path, "wb") as f:
        f.write(contents)

    try:
        df = load_dataframe(dest_path)
    except Exception as e:
        os.remove(dest_path)
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")

    result = validate_dataset(df, kind)
    if not result["valid"]:
        os.remove(dest_path)
        raise HTTPException(status_code=422, detail={"errors": result["errors"], "warnings": result["warnings"]})

    clean_df = result.pop("dataframe")
    clean_df.to_csv(dest_path if dest_path.endswith(".csv") else dest_path + ".clean.csv", index=False)

    dataset = models.UploadedDataset(
        site_id=site.site_id,
        filename=file.filename,
        kind=kind,
        row_count=result["row_count"],
        columns=result["columns"],
        warnings=result["warnings"],
        storage_path=dest_path,
    )
    db.add(dataset)

    if kind == "solar":
        site.solar_has_history = True
    elif kind == "demand":
        site.demand_has_history = True
    elif kind == "ev":
        site.ev_has_history = True

    db.commit()
    db.refresh(dataset)

    return {
        "dataset_id": dataset.dataset_id,
        "row_count": dataset.row_count,
        "columns": dataset.columns,
        "warnings": dataset.warnings,
    }
