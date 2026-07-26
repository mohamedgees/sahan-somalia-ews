"""Drought and flash-flood alert endpoints."""

from fastapi import APIRouter

from app.core.errors import api_error_response
from app.services.flood_processor import flood_processor

router = APIRouter()


@router.get("/api/alerts")
def get_alerts_endpoint(level: int = 1):

    from app.services.gee_utils import get_alerts

    try:

        data = get_alerts(level)

        return {"level": "Region" if level == 1 else "District", "alerts": data}

    except Exception as e:

        return api_error_response(e)


@router.get("/api/alerts/flash-flood")
def get_flash_flood_alerts(threshold: float = 50.0):

    try:

        data = flood_processor.get_flood_alerts(threshold=threshold)

        return data

    except Exception as e:

        return api_error_response(e)
