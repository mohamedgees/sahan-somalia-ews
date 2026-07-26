"""Map tile / raster layer endpoints — one per satellite-derived index or
forecast product, each returning a Google Earth Engine tile URL (or, for
flash-flood-basins, a GeoJSON FeatureCollection)."""

from fastapi import APIRouter

from app.core.errors import api_error_response
from app.services.flood_processor import flood_processor

router = APIRouter()


@router.get("/api/layers/ndvi")
def get_ndvi_endpoint(days: int = 30, start: str = None, end: str = None):

    from datetime import datetime, timedelta

    from app.services.gee_utils import get_ndvi_layer

    # Logic: If explicit start/end provided, use them. Else use 'days'.

    if start and end:

        start_str = start

        end_str = end

    else:

        end_date = datetime.now()

        start_date = end_date - timedelta(days=days)

        start_str = start_date.strftime("%Y-%m-%d")

        end_str = end_date.strftime("%Y-%m-%d")

    try:

        tile_url = get_ndvi_layer(start_str, end_str)

        return {
            "url": tile_url,
            "period": f"{start_str} to {end_str}",
            "attribution": "Sentinel-2 / Google Earth Engine",
        }

    except Exception as e:

        return api_error_response(e)


@router.get("/api/layers/forecast")
def get_forecast_layer_endpoint(type: str, days: int = 7):

    from app.services.gee_utils import get_gfs_forecast_layer

    try:

        # type should be 'precip' or 'temp'

        tile_url = get_gfs_forecast_layer(type, days)

        return {
            "url": tile_url,
            "variable": type,
            "days": days,
            "attribution": "NOAA GFS / Google Earth Engine",
        }

    except Exception as e:

        return api_error_response(e)


@router.get("/api/layers/cdi")
def get_cdi_endpoint(date: str = None):

    from datetime import datetime

    from app.services.gee_utils import get_cdi_layer

    if not date:

        date = datetime.now().strftime("%Y-%m-%d")

    try:

        tile_url = get_cdi_layer(date)

        return {
            "url": tile_url,
            "date": date,
            "attribution": "CHIRPS/FLDAS/MODIS / TerraTech Solutions",
        }

    except Exception as e:

        return api_error_response(e)


@router.get("/api/layers/smi")
def get_smi_endpoint(date: str = None, start: str = None):

    from datetime import datetime, timedelta

    from app.services.gee_utils import get_smi_layer

    date = date or start

    if not date:

        date = (datetime.now() - timedelta(days=32)).strftime(
            "%Y-%m-01"
        )  # Use last month since FLDAS has lag

    try:

        tile_url = get_smi_layer(date)

        return {
            "url": tile_url,
            "date": date,
            "period": f"Month of {date}",
            "attribution": "NASA FLDAS / Google Earth Engine",
        }

    except Exception as e:

        return api_error_response(e)


@router.get("/api/layers/spei")
def get_spei_endpoint(date: str = None, start: str = None):

    from datetime import datetime, timedelta

    from app.services.gee_utils import get_spei_layer

    date = date or start

    if not date:

        # SPEI dataset now uses FLDAS, which has about 1 month lag

        date = (datetime.now() - timedelta(days=32)).strftime("%Y-%m-01")

    try:

        tile_url = get_spei_layer(date)

        return {
            "url": tile_url,
            "date": date,
            "period": f"Month of {date}",
            "attribution": "CSIC / Google Earth Engine",
        }

    except Exception as e:

        return api_error_response(e)


@router.get("/api/layers/spi")
def get_spi_endpoint(date: str = None, start: str = None):

    from datetime import datetime

    from app.services.gee_utils import get_spi_layer

    date = date or start

    if not date:

        date = datetime.now().strftime("%Y-%m-%d")

    try:

        tile_url = get_spi_layer(date)

        return {
            "url": tile_url,
            "date": date,
            "period": f"Month of {date}",
            "attribution": "CHIRPS / Google Earth Engine",
        }

    except Exception as e:

        return api_error_response(e)


@router.get("/api/layers/vhi")
def get_vhi_endpoint(date: str = None, start: str = None):

    from datetime import datetime

    from app.services.gee_utils import get_vhi_layer

    date = date or start

    if not date:

        date = datetime.now().strftime("%Y-%m-01")

    try:

        tile_url = get_vhi_layer(date)

        return {
            "url": tile_url,
            "date": date,
            "period": f"Month of {date}",
            "attribution": "MODIS (VCI/TCI) / Google Earth Engine",
        }

    except Exception as e:

        return api_error_response(e)


@router.get("/api/layers/temperature_anomaly")
@router.get("/api/layers/temp_anomaly")
def get_temp_anomaly_endpoint(date: str = None, start: str = None):

    from datetime import datetime

    from app.services.gee_utils import get_temp_anomaly_layer

    date = date or start

    if not date:

        date = datetime.now().strftime("%Y-%m-%d")

    try:

        tile_url = get_temp_anomaly_layer(date)

        return {
            "url": tile_url,
            "date": date,
            "period": f"Month of {date}",
            "attribution": "MODIS LST / Google Earth Engine",
        }

    except Exception as e:

        return api_error_response(e)


@router.get("/api/layers/tci")
def get_tci_endpoint(date: str = None, start: str = None):

    from datetime import datetime

    from app.services.gee_utils import get_tci_layer

    date = date or start

    if not date:

        date = datetime.now().strftime("%Y-%m-01")

    try:

        tile_url = get_tci_layer(date)

        return {
            "url": tile_url,
            "date": date,
            "period": f"Month of {date}",
            "attribution": "MODIS LST / Google Earth Engine",
        }

    except Exception as e:

        return api_error_response(e)


@router.get("/api/layers/bsi")
def get_bsi_endpoint(date: str = None, start: str = None):

    from datetime import datetime

    from app.services.gee_utils import get_bsi_layer

    date = date or start

    if not date:

        date = datetime.now().strftime("%Y-%m-01")

    try:

        tile_url = get_bsi_layer(date)

        return {
            "url": tile_url,
            "date": date,
            "period": f"Month of {date}",
            "attribution": "Sentinel-2 / TerraTech Solutions",
        }

    except Exception as e:

        return api_error_response(e)


@router.get("/api/layers/rainfall")
def get_rainfall_endpoint(days: int = 30, start: str = None, end: str = None):

    from datetime import datetime, timedelta

    from app.services.gee_utils import get_rainfall_layer

    if start and end:

        start_str = start

        end_str = end

    else:

        end_date = datetime.now()

        start_date = end_date - timedelta(days=days)

        start_str = start_date.strftime("%Y-%m-%d")

        end_str = end_date.strftime("%Y-%m-%d")

    try:

        tile_url = get_rainfall_layer(start_str, end_str)

        return {
            "url": tile_url,
            "period": f"{start_str} to {end_str}",
            "attribution": "CHIRPS / Google Earth Engine",
        }

    except Exception as e:

        return api_error_response(e)


@router.get("/api/layers/temperature")
@router.get("/api/layers/temp")
def get_temperature_endpoint(days: int = 30, start: str = None, end: str = None):

    from datetime import datetime, timedelta

    from app.services.gee_utils import get_temperature_layer

    if start and end:

        start_str = start

        end_str = end

    else:

        end_date = datetime.now()

        start_date = end_date - timedelta(days=days)

        start_str = start_date.strftime("%Y-%m-%d")

        end_str = end_date.strftime("%Y-%m-%d")

    try:

        tile_url = get_temperature_layer(start_str, end_str)

        return {
            "url": tile_url,
            "period": f"{start_str} to {end_str}",
            "attribution": "MODIS / Google Earth Engine",
        }

    except Exception as e:

        return api_error_response(e)


@router.get("/api/layers/flash-flood-basins")
def get_flash_flood_basins(threshold: float = 50.0):

    try:

        data = flood_processor.get_flood_alerts(threshold=threshold)

        if "error" in data:

            return data

        return data.get("layer_data", {})

    except Exception as e:

        return api_error_response(e)
