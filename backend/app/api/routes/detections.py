from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse

from app.api.routes.store import SPILL_STORE
from app.schemas.detection import (
    ArtifactRefs,
    DetectionError,
    DetectionMetadata,
    DetectionResponse,
    JobStatus,
)
from app.services.detector_service import detector_service
from app.services.detection_store import detection_store

router = APIRouter(tags=["detections"])


@router.post(
    "/spills/{spill_id}/detect",
    response_model=DetectionResponse,
    status_code=status.HTTP_200_OK,
)
def create_detection_for_spill(spill_id: str):
    spill = SPILL_STORE.get(spill_id)
    if not spill:
        raise HTTPException(status_code=404, detail="Spill not found.")

    file_path = spill.get("saved_path")
    if not file_path:
        raise HTTPException(status_code=400, detail="Uploaded spill has no saved file path.")

    now = datetime.now(timezone.utc)
    job_id = uuid4()

    queued_job = DetectionResponse(
        job_id=job_id,
        scene_id=spill_id,
        status=JobStatus.QUEUED,
        message="Detection job queued.",
        artifacts=None,
        metadata=None,
        error=None,
        created_at=now,
        updated_at=now,
    )
    detection_store.save(queued_job)

    processing_job = detection_store.update(
        job_id,
        status=JobStatus.PROCESSING,
        message="Detection in progress.",
    )
    if processing_job is None:
        raise HTTPException(status_code=500, detail="Could not update job state.")

    try:
        raw = detector_service.run(
            file_path=file_path,
            scene_id=spill_id,
        )
        normalized = detector_service.normalize(raw)

        final_job = DetectionResponse(
            job_id=job_id,
            scene_id=spill_id,
            status=JobStatus(normalized["status"]),
            message=normalized["message"],
            artifacts=ArtifactRefs(**normalized["artifacts"]),
            metadata=DetectionMetadata(**normalized["metadata"]),
            error=None,
            created_at=queued_job.created_at,
            updated_at=datetime.now(timezone.utc),
        )
        detection_store.save(final_job)

        spill["status"] = "detected"
        spill["detection_job_id"] = str(job_id)
        spill["detected_at"] = final_job.updated_at
        spill["detection_message"] = final_job.message

        return final_job

    except ValueError as exc:
        code, message = exc.args[0] if exc.args else ("ERR_INVALID_FILE", "Invalid file input.")
    except RuntimeError as exc:
        code, message = exc.args[0] if exc.args else ("ERR_DETECTOR_FAILURE", "Detector execution failed.")
    except Exception:
        code, message = ("ERR_DETECTOR_FAILURE", "Unexpected detector failure.")

    failed_job = DetectionResponse(
        job_id=job_id,
        scene_id=spill_id,
        status=JobStatus.FAILED,
        message=message,
        artifacts=None,
        metadata=None,
        error=DetectionError(code=code, message=message),
        created_at=queued_job.created_at,
        updated_at=datetime.now(timezone.utc),
    )
    detection_store.save(failed_job)

    spill["status"] = "detection_failed"
    spill["detection_job_id"] = str(job_id)
    spill["detected_at"] = failed_job.updated_at
    spill["detection_message"] = failed_job.message

    return JSONResponse(
        status_code=500,
        content=failed_job.model_dump(mode="json"),
    )


@router.get("/detections/{job_id}", response_model=DetectionResponse, status_code=status.HTTP_200_OK)
def get_detection(job_id: str):
    job = detection_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Detection job not found.")
    return job