"""Point-based timeseries and national/district drought-stats endpoints."""

from fastapi import APIRouter

from app.core.errors import api_error_response

router = APIRouter()


@router.get("/api/stats/point")
def get_point_stats(lat: float, lon: float):

    from datetime import datetime, timedelta

    from app.services.gee_utils import get_ndvi_timeseries

    # Default to 1 year of data for trends

    end_date = datetime.now()

    start_date = end_date - timedelta(days=365)

    start_str = start_date.strftime("%Y-%m-%d")

    end_str = end_date.strftime("%Y-%m-%d")

    try:

        from app.services.gee_utils import is_inside_somalia

        if not is_inside_somalia(lat, lon):

            from fastapi import HTTPException

            raise HTTPException(status_code=400, detail="Out of the Area of Interest")

        data = get_ndvi_timeseries(lat, lon, start_str, end_str)

        return {"latitude": lat, "longitude": lon, "period": "Last 12 Months", "data": data}

    except Exception as e:

        return api_error_response(e)


@router.get("/api/stats/point_v2")
def get_point_stats_v2(lat: float, lon: float, type: str = "ndvi", end: str = None):

    from datetime import datetime, timedelta

    from app.services.gee_utils import get_ndvi_timeseries, get_rainfall_timeseries

    if end:

        end_date = datetime.strptime(end, "%Y-%m-%d")

    else:

        end_date = datetime.now()

    if type == "ndvi":

        start_date = end_date - timedelta(days=365)

    else:

        # Rainfall: Last 180 days (6 months) or similarly scaled

        start_date = end_date - timedelta(days=180)

    start_str = start_date.strftime("%Y-%m-%d")

    end_str = end_date.strftime("%Y-%m-%d")

    try:

        from app.services.gee_utils import is_inside_somalia

        if not is_inside_somalia(lat, lon):

            from fastapi import HTTPException

            raise HTTPException(status_code=400, detail="Out of the Area of Interest")

        if type == "rainfall":

            data = get_rainfall_timeseries(lat, lon, start_str, end_str)

            label = "Precipitation (mm)"

        elif type == "smi":

            from app.services.gee_utils import get_smi_timeseries

            data = get_smi_timeseries(lat, lon)

            label = "Soil Moisture Index (SMDI)"

        elif type == "spei":

            from app.services.gee_utils import get_spei_timeseries

            data = get_spei_timeseries(lat, lon)

            label = "SPEI (01-Month)"

        elif type == "spi":

            from app.services.gee_utils import get_spi_timeseries

            data = get_spi_timeseries(lat, lon)

            label = "SPI (CHIRPS Rainfall Index)"

        elif type == "vhi":

            from app.services.gee_utils import get_vhi_timeseries

            data = get_vhi_timeseries(lat, lon)

            label = "Vegetation Health Index (VHI)"

        elif type == "temp_anomaly":

            from app.services.gee_utils import get_temp_anomaly_timeseries

            data = get_temp_anomaly_timeseries(lat, lon)

            label = "Temperature Anomaly (Standardized)"

        elif type == "tci":

            from app.services.gee_utils import get_tci_timeseries

            data = get_tci_timeseries(lat, lon)

            label = "Temperature Condition Index (TCI)"

        elif type == "bsi":

            from app.services.gee_utils import get_bsi_timeseries

            data = get_bsi_timeseries(lat, lon)

            label = "Bare Soil Index (BSI)"

        elif type == "temperature" or type == "temp":

            from app.services.gee_utils import get_temperature_timeseries

            data = get_temperature_timeseries(lat, lon, start_str, end_str)

            label = "Temperature ( degrees C)"

        elif type.startswith("forecast_precip"):

            from app.services.gee_utils import get_gfs_forecast_timeseries

            data = get_gfs_forecast_timeseries(lat, lon, "precip")

            label = "Predicted Rainfall (mm)"

        elif type.startswith("forecast_temp"):

            from app.services.gee_utils import get_gfs_forecast_timeseries

            data = get_gfs_forecast_timeseries(lat, lon, "temp")

            label = "Predicted Temperature ( degrees C)"

        elif type == "cdi":

            from app.services.gee_utils import get_cdi_timeseries

            data = get_cdi_timeseries(lat, lon)

            label = "Combined Drought Index (CDI)"

        else:

            data = get_ndvi_timeseries(lat, lon, start_str, end_str)

            label = "NDVI"

        return {"latitude": lat, "longitude": lon, "type": type, "data": data, "label": label}

    except Exception as e:

        return api_error_response(e)


@router.get("/api/drought/stats")
def get_drought_stats_endpoint(date: str = None):

    from app.services.gee_utils import get_drought_stats

    try:

        data = get_drought_stats(date)

        return data

    except Exception as e:

        return api_error_response(e)
