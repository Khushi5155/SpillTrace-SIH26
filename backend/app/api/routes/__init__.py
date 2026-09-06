from fastapi import APIRouter

from backend.app.api.routes import system
from backend.app.api.routes.detections import router as detections_router

api_router = APIRouter()

api_router.include_router(system.router, tags=["system"])
api_router.include_router(detections_router, tags=["detections"])