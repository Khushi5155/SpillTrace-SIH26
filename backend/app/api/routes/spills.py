from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.schemas import SpillGeometry, SpillMetadataResponse, SpillResponse, SpillUploadResponse
from app.api.routes.store import SPILL_STORE

router = APIRouter(prefix="/spills", tags=["spills"])

BASE_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = BASE_DIR / "data" / "sar"
DATA_DIR.mkdir(parents=True, exist_ok=True)

from app.services.detector_service import detector_service


def run_detector(saved_path: str, spill_id: str) -> dict:
    path = Path(saved_path)
    if not path.exists():
        raise FileNotFoundError(f"Uploaded file not found at {saved_path}")

    raw = detector_service.run(
        file_path=saved_path,
        scene_id=spill_id,
    )
    normalized = detector_service.normalize(raw)

    geometry_data = (
        normalized.get("metadata", {}).get("geometry")
        or normalized.get("geometry")
    )
    if not geometry_data:
        raise RuntimeError("Detector returned no geometry.")

    geometry = SpillGeometry(**geometry_data)

    return {
        "message": normalized["message"],
        "geometry": geometry,
        "area_sq_km": normalized.get("metadata", {}).get("area_sq_km", 0.0),
        "detector_name": normalized.get("metadata", {}).get("detector_name", "detector-service"),
    }

@router.post("/upload", response_model=SpillUploadResponse)
async def upload_spill(file: UploadFile = File(...)):
    spill_id = str(uuid4())
    uploaded_at = datetime.now(timezone.utc)

    original_name = file.filename or f"{spill_id}.bin"
    stored_name = f"{spill_id}_{original_name}"
    stored_path = DATA_DIR / stored_name

    content = await file.read()
    stored_path.write_bytes(content)

    SPILL_STORE[spill_id] = {
        "spill_id": spill_id,
        "filename": original_name,
        "content_type": file.content_type or "application/octet-stream",
        "saved_path": str(stored_path.resolve()),
        "uploaded_at": uploaded_at,
        "status": "uploaded",
        "source": "manual-upload",
    }

    return SpillUploadResponse(**SPILL_STORE[spill_id])


@router.post("/{spill_id}/detect", response_model=SpillResponse)
async def detect_spill(spill_id: str):
    spill = SPILL_STORE.get(spill_id)
    if not spill:
        raise HTTPException(status_code=404, detail="Spill not found")

    saved_path = spill["saved_path"]

    try:
        detection = run_detector(saved_path, spill_id)
    except FileNotFoundError as exc:
        spill["status"] = "detection_failed"
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        spill["status"] = "detection_failed"
        raise HTTPException(
            status_code=500,
            detail={
                "code": "DETECTION_FAILED",
                "message": "Detector execution failed",
                "details": {"spill_id": spill_id, "error": str(exc)},
            },
        )

    detected_at = datetime.now(timezone.utc)

    spill["status"] = "detected"
    spill["detected_at"] = detected_at
    spill["geometry"] = detection["geometry"].model_dump()
    spill["area_sq_km"] = detection["area_sq_km"]
    spill["detector_name"] = detection.get("detector_name")

    return SpillResponse(
        spill_id=spill_id,
        status="detected",
        message=detection["message"],
        geometry=detection["geometry"],
        area_sq_km=detection["area_sq_km"],
        detected_at=detected_at,
    )


@router.get("/{spill_id}", response_model=SpillMetadataResponse)
async def get_spill(spill_id: str):
    spill = SPILL_STORE.get(spill_id)
    if not spill:
        raise HTTPException(status_code=404, detail="Spill not found")

    return SpillMetadataResponse(**spill)