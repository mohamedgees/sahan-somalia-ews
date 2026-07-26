"""Health-check endpoint — reports whether the Google Earth Engine
connection is live."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/api/health-check")
def health_check():

    from app.services.gee_utils import GEE_ERROR, GEE_INITIALIZED, init_gee

    # Try to init if not already

    try:

        if not GEE_INITIALIZED:

            init_gee()

    except Exception:

        pass  # GEE_ERROR will be set, handle below

    if GEE_INITIALIZED:

        return {"status": "connected", "message": "Google Earth Engine is live"}

    else:

        # Return HTTP 200 (OK) but with error status so frontend can display it

        # Or 503 if you want to be strict, but frontend expects JSON

        return {"status": "error", "message": f"GEE Auth Failed: {GEE_ERROR}"}
