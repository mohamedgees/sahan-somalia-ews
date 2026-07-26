import json
import logging
import math
import os
from datetime import datetime, timedelta

import ee
from dateutil.relativedelta import relativedelta
from google.oauth2 import service_account

logger = logging.getLogger("somalia_ews.gee_utils")

# Global variable to store initialization status
GEE_INITIALIZED = False
GEE_ERROR = None

# SWALIM Rainfall Palette and Breaks
SWALIM_RAINFALL_PALETTE = [
    "FFFFFF",  # 0-2
    "FFFBCC",  # 2-5
    "BCE895",  # 5-10
    "2E6219",  # 10-20
    "53BBD4",  # 20-30
    "29AEE2",  # 30-40
    "5C97ED",  # 40-50
    "1D3F96",  # 50-100
    "441269",  # 100-150
    "D64A13",  # 150-200
    "7A2617",  # 200-250
]
SWALIM_RAINFALL_BREAKS = [2, 5, 10, 20, 30, 40, 50, 100, 150, 200, 250]

# Season Definitions
SEASONS = [
    {"name": "Jilaal", "months": [1, 2, 3], "type": "dry"},
    {"name": "Gu", "months": [4, 5, 6], "type": "rainy"},
    {"name": "Xagaa", "months": [7, 8, 9], "type": "dry"},
    {"name": "Deyr", "months": [10, 11, 12], "type": "rainy"},
]


def get_season_info(month: int) -> dict:
    """Return the Somalia seasonal-calendar entry (name/months/type) containing `month`."""
    for s in SEASONS:
        if month in s["months"]:
            return s
    return SEASONS[0]


def classify_swalim_rainfall(image):
    """
    Classifies a precipitation image into SWALIM discrete buckets.
    """
    classified = ee.Image(0)
    for i in range(len(SWALIM_RAINFALL_BREAKS) - 1):
        b = SWALIM_RAINFALL_BREAKS[i]
        classified = classified.where(image.gt(b), i + 1)
    return classified


def get_key_path():
    """
    Locate the gee-key.json file.
    """
    if os.environ.get("GEE_KEY_PATH"):
        return os.environ.get("GEE_KEY_PATH")
    from app.core.paths import BACKEND_DIR, PROJECT_ROOT

    path_root = os.path.join(PROJECT_ROOT, "gee-key.json")
    if os.path.exists(path_root):
        return path_root
    path_backend = os.path.join(BACKEND_DIR, "gee-key.json")
    if os.path.exists(path_backend):
        return path_backend
    return path_root


KEY_PATH = get_key_path()


def init_gee():
    """
    Authenticates and initializes Google Earth Engine using the service account key.
    """
    global GEE_INITIALIZED, GEE_ERROR
    if GEE_INITIALIZED:
        return True
    if not os.path.exists(KEY_PATH):
        GEE_ERROR = f"Service account key not found at: {KEY_PATH}"
        raise FileNotFoundError(GEE_ERROR)
    try:
        credentials = service_account.Credentials.from_service_account_file(KEY_PATH)
        scoped_credentials = credentials.with_scopes(
            ["https://www.googleapis.com/auth/earthengine"]
        )
        ee.Initialize(credentials=scoped_credentials)
        GEE_INITIALIZED = True
        return True
    except Exception as e:
        GEE_ERROR = str(e)
        raise e


def require_gee():
    """Lazily initialize GEE on first use if a prior call hasn't already done so."""
    if not GEE_INITIALIZED:
        init_gee()


def is_inside_somalia(lat: float, lon: float) -> bool:
    """Check whether a lat/lon point falls within Somalia's national boundary (USDOS LSIB)."""
    require_gee()
    point = ee.Geometry.Point([lon, lat])
    countries = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017")
    somalia = countries.filter(ee.Filter.eq("country_na", "Somalia")).geometry()
    return somalia.contains(point).getInfo()


def sanitize_url(map_id_obj: dict) -> str | None:
    """Extract a usable {z}/{x}/{y} tile URL template from a GEE getMapId() response."""
    if not map_id_obj:
        return None
    url = map_id_obj.get("tile_fetcher").url_format if "tile_fetcher" in map_id_obj else None
    if not url:
        return None
    if "{state.tile_base_url}" in url:
        mid = map_id_obj.get("map_id") or map_id_obj.get("mapid")
        if mid:
            url = f"https://earthengine.googleapis.com/v1/{mid}/tiles/{{z}}/{{x}}/{{y}}"
    url = url.replace("{{", "{").replace("}}", "}")
    url = url.replace("{version}", "1")
    return url


def get_ndvi_layer(start_date: str, end_date: str) -> str:
    """NDVI map tile layer (MODIS MOD13Q1, 16-day composite, median over the period)."""
    require_gee()
    countries = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017")
    somalia = countries.filter(ee.Filter.eq("country_na", "Somalia")).geometry()
    collection = (
        ee.ImageCollection("MODIS/061/MOD13Q1")
        .filterDate(start_date, end_date)
        .filterBounds(somalia)
    )
    if collection.size().getInfo() == 0:
        latest = (
            ee.ImageCollection("MODIS/061/MOD13Q1")
            .filterBounds(somalia)
            .sort("system:time_start", False)
            .limit(1)
        )
        if latest.size().getInfo() > 0:
            collection = latest

    def scale_ndvi(image):
        return image.select("NDVI").multiply(0.0001).rename("NDVI")

    image = collection.map(scale_ndvi).median().clip(somalia)
    vis_params = {
        "min": 0,
        "max": 0.9,
        "palette": [
            "FFFFFF",
            "CE7E45",
            "DF923D",
            "F1B555",
            "FCD163",
            "99B718",
            "74A901",
            "66A000",
            "529400",
            "3E8601",
            "207401",
            "056201",
            "004C00",
            "023B01",
            "012E01",
            "011D01",
            "011301",
        ],
        "crs": "EPSG:4326",
    }
    map_id = image.getMapId(vis_params)
    return sanitize_url(map_id)


def get_ndvi_timeseries(lat: float, lon: float, start_date: str, end_date: str) -> list[dict]:
    """Point NDVI time series (Sentinel-2 SR, 10m — a different, higher-resolution source
    than get_ndvi_layer's MODIS composite, since a single point can resolve Sentinel-2's
    finer pixel size)."""
    require_gee()
    point = ee.Geometry.Point([lon, lat])
    collection = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterDate(start_date, end_date)
        .filterBounds(point)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
        .select(["B8", "B4"])
    )

    def set_ndvi_and_date(image):
        ndvi = image.normalizedDifference(["B8", "B4"]).rename("NDVI")
        date = image.date().format("YYYY-MM-dd")
        stats = ndvi.reduceRegion(reducer=ee.Reducer.mean(), geometry=point, scale=10)
        return ee.Feature(None, {"ndvi": stats.get("NDVI"), "date": date})

    features = (
        collection.map(set_ndvi_and_date).filter(ee.Filter.notNull(["ndvi"])).sort("date", False)
    )
    data_list = features.limit(150).getInfo()
    results = [
        {"date": f["properties"]["date"], "value": f["properties"]["ndvi"]}
        for f in data_list["features"]
    ]
    results.sort(key=lambda x: x["date"])
    return results


def get_alerts(admin_level: int) -> list[dict]:
    """NDVI-based drought alerts per admin unit (FAO GAUL level 1/2), from the last 45
    days of MODIS NDVI. This is a simple absolute-NDVI threshold, independent of the
    CDI/VCI/TCI seasonal-anomaly indices used elsewhere."""
    require_gee()
    table_id = f"FAO/GAUL/2015/level{admin_level}"
    admins = ee.FeatureCollection(table_id).filter(ee.Filter.eq("ADM0_NAME", "Somalia"))
    now = datetime.now()
    start_str = (now - timedelta(days=45)).strftime("%Y-%m-%d")
    end_str = now.strftime("%Y-%m-%d")
    modis_collection = ee.ImageCollection("MODIS/061/MOD13Q1").filterDate(start_str, end_str)
    ndvi_mean = (
        modis_collection.select("NDVI").median().multiply(0.0001).rename("mean_ndvi").clip(admins)
    )
    stats = ndvi_mean.reduceRegions(collection=admins, reducer=ee.Reducer.mean(), scale=5000)
    data = stats.filter(ee.Filter.notNull(["mean_ndvi"])).limit(300).getInfo()
    alerts = []
    for feat in data["features"]:
        props = feat["properties"]
        val = props.get("mean_ndvi", 0)
        if val is None:
            continue
        status = "Normal"
        color = "#2ecc71"
        if val < 0.2:
            status = "Severe Drought"
            color = "#e74c3c"
        elif val < 0.35:
            status = "Moderate Drought"
            color = "#f39c12"
        alerts.append(
            {
                "name": props.get(f"ADM{admin_level}_NAME", "Unknown"),
                "mean_ndvi": round(val, 3),
                "status": status,
                "color": color,
                "geometry": feat["geometry"],
            }
        )
    return alerts


def get_rainfall_layer(start_date: str, end_date: str) -> str:
    """Cumulative CHIRPS rainfall (mm) over the period, SWALIM-classified for the map."""
    require_gee()
    countries = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017")
    somalia = countries.filter(ee.Filter.eq("country_na", "Somalia"))
    collection = (
        ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
        .filterDate(start_date, end_date)
        .filterBounds(somalia)
    )
    if collection.size().getInfo() == 0:
        latest_img = (
            ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY").sort("system:time_start", False).first()
        )
        latest_date = ee.Date(latest_img.get("system:time_start"))
        collection = (
            ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
            .filterDate(latest_date.advance(-30, "day"), latest_date.advance(1, "day"))
            .filterBounds(somalia)
        )
    precip = collection.sum().clip(somalia)
    image = classify_swalim_rainfall(precip).clip(somalia)
    vis_params = {"min": 0, "max": 10, "palette": SWALIM_RAINFALL_PALETTE}
    return sanitize_url(image.getMapId(vis_params))


def get_rainfall_timeseries(lat: float, lon: float, start_date: str, end_date: str) -> list[dict]:
    """Daily CHIRPS rainfall (mm) at a point over the period."""
    require_gee()
    point = ee.Geometry.Point([lon, lat])
    collection = (
        ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
        .filterDate(start_date, end_date)
        .filterBounds(point)
    )

    def set_val_and_date(image):
        stats = image.reduceRegion(ee.Reducer.mean(), point, 5000)
        return ee.Feature(
            None, {"value": stats.get("precipitation"), "date": image.date().format("YYYY-MM-dd")}
        )

    data_list = (
        collection.map(set_val_and_date)
        .filter(ee.Filter.notNull(["value"]))
        .sort("date")
        .limit(180)
        .getInfo()
    )
    return [
        {"date": f["properties"]["date"], "value": round(f["properties"]["value"], 2)}
        for f in data_list["features"]
    ]


def _yearly_climatology_stats(collection, band, target_month, start_year, end_year, aggregation):
    """Builds one aggregated image per year for the given calendar month (sum for flux/
    accumulation bands like precipitation, mean otherwise), then returns the mean/stdDev
    across that yearly population. This is the correct statistical population for a
    standardized anomaly (SPI-style): year-to-year variability of the monthly aggregate,
    not day-to-day variability of the raw sub-monthly observations."""
    years = ee.List.sequence(start_year, end_year)

    def yearly_agg(y):
        y = ee.Number(y)
        m_start = ee.Date.fromYMD(y, target_month, 1)
        m_end = m_start.advance(1, "month")
        imgs = collection.filterDate(m_start, m_end).select(band)
        agg = imgs.sum() if aggregation == "sum" else imgs.mean()
        return agg.set("system:time_start", m_start.millis())

    yearly_col = ee.ImageCollection(years.map(yearly_agg))
    mean = yearly_col.mean()
    std = yearly_col.reduce(ee.Reducer.stdDev())
    return mean, std


def get_monthly_anomaly(
    collection, band, target_date, climatology_start="1991-01-01", climatology_end="2020-12-31"
):
    """Standardized (Z-score) anomaly of `band` for the calendar month of `target_date`,
    against a yearly climatology population (see _yearly_climatology_stats). Used for
    SPI (CHIRPS precipitation), SMI (FLDAS soil moisture), and temperature anomaly
    (MODIS LST). Falls back to the prior month if `target_date`'s month has no data yet."""
    date = ee.Date(target_date)
    target_month = date.get("month")
    start_year = ee.Date(climatology_start).get("year")
    end_year = ee.Date(climatology_end).get("year")
    aggregation = "sum" if band == "precipitation" else "mean"

    mean, std = _yearly_climatology_stats(
        collection, band, target_month, start_year, end_year, aggregation
    )

    current_month_start = date.update(day=1)
    current_month_end = current_month_start.advance(1, "month")
    current_col = collection.filterDate(current_month_start, current_month_end).select(band)
    if current_col.size().getInfo() == 0:
        current_month_start = current_month_start.advance(-1, "month")
        current_col = collection.filterDate(
            current_month_start, current_month_start.advance(1, "month")
        ).select(band)
        target_month = current_month_start.get("month")
        mean, std = _yearly_climatology_stats(
            collection, band, target_month, start_year, end_year, aggregation
        )

    current_agg = current_col.sum() if aggregation == "sum" else current_col.mean()
    current_img = ee.Image(
        ee.Algorithms.If(current_agg.bandNames().size(), current_agg, mean.multiply(0))
    )
    std_band = f"{band}_stdDev"
    if band == "precipitation":
        std_safe = std.select(std_band).max(0.5)
    elif band == "SoilMoi00_10cm_tavg":
        std_safe = std.select(std_band).max(0.01)
    else:
        std_safe = std.select(std_band).where(std.select(std_band).eq(0), 0.001)
    anomaly = current_img.subtract(mean).divide(std_safe).rename("anomaly")
    countries = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017")
    somalia = countries.filter(ee.Filter.eq("country_na", "Somalia")).geometry()
    return anomaly.clip(somalia)


def _monthly_water_balance(era5_collection, month_start):
    """Monthly D = Precipitation - PET (mm), from ERA5-Land DAILY_AGGR.
    ECMWF's convention: potential_evaporation_sum is negative (upward/evaporative flux),
    so D = precip_mm + pet_sum_mm (adding the negative PET is equivalent to subtracting
    its magnitude). Both source bands are in metres; converted to mm here."""
    month_end = month_start.advance(1, "month")
    col = era5_collection.filterDate(month_start, month_end)
    precip_mm = col.select("total_precipitation_sum").sum().multiply(1000)
    pet_mm = col.select("potential_evaporation_sum").sum().multiply(1000)
    return precip_mm.rename("D").add(pet_mm.rename("D"))


def get_water_balance_anomaly(
    target_date, climatology_start="1991-01-01", climatology_end="2020-12-31"
):
    """Standardized precipitation-evapotranspiration anomaly (real SPEI: P - PET, not just
    rainfall). PET is ERA5-Land's own physically-based potential_evaporation_sum, so no
    hand-rolled Hargreaves/Ra estimate is needed. Uses the same yearly-population approach
    as get_monthly_anomaly (one D value per year for the target calendar month, then
    standardized against that population), instead of pooling raw daily/sub-monthly values."""
    era5 = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR")
    date = ee.Date(target_date)
    target_month = date.get("month")
    start_year = ee.Date(climatology_start).get("year")
    end_year = ee.Date(climatology_end).get("year")

    def build_stats(month):
        years = ee.List.sequence(start_year, end_year)

        def yearly_d(y):
            y = ee.Number(y)
            m_start = ee.Date.fromYMD(y, month, 1)
            return _monthly_water_balance(era5, m_start).set("system:time_start", m_start.millis())

        yearly_col = ee.ImageCollection(years.map(yearly_d))
        return yearly_col.mean(), yearly_col.reduce(ee.Reducer.stdDev())

    mean, std = build_stats(target_month)

    current_month_start = date.update(day=1)
    current_month_end = current_month_start.advance(1, "month")
    if era5.filterDate(current_month_start, current_month_end).size().getInfo() == 0:
        current_month_start = current_month_start.advance(-1, "month")
        target_month = current_month_start.get("month")
        mean, std = build_stats(target_month)

    current_d = _monthly_water_balance(era5, current_month_start)
    std_safe = std.select("D_stdDev").max(
        5.0
    )  # floor: 5mm, analogous to the 0.5mm SPI floor at monthly scale
    anomaly = current_d.subtract(mean).divide(std_safe).rename("anomaly")
    countries = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017")
    somalia = countries.filter(ee.Filter.eq("country_na", "Somalia")).geometry()
    return anomaly.clip(somalia)


def get_vci_image(date_obj, somalia_geom):
    """VCI (Vegetation Condition Index, Kogan 1995): 100 * (NDVI - NDVI_min) / (NDVI_max -
    NDVI_min), using the full MODIS historical record (2000-present) for min/max per
    calendar month."""
    month = date_obj.get("month")
    ndvi_col = ee.ImageCollection("MODIS/061/MOD13Q1").select("NDVI")
    ndvi_month = ndvi_col.filter(ee.Filter.calendarRange(month, month, "month"))
    ndvi_min_max = ndvi_month.reduce(ee.Reducer.minMax())

    current_ndvi = ndvi_col.filterDate(
        date_obj.update(day=1), date_obj.advance(1, "month")
    ).median()
    current_ndvi = ee.Image(
        ee.Algorithms.If(
            current_ndvi.bandNames().size(),
            current_ndvi,
            ndvi_col.filterDate(date_obj.advance(-1, "month"), date_obj).median(),
        )
    )

    vci = (
        current_ndvi.subtract(ndvi_min_max.select("NDVI_min"))
        .divide(ndvi_min_max.select("NDVI_max").subtract(ndvi_min_max.select("NDVI_min")))
        .multiply(100)
        .rename("vci")
    )
    return vci.clip(somalia_geom)


def get_tci_image(date_obj, somalia_geom):
    """TCI (Temperature Condition Index, Kogan): 100 * (LST_max - LST) / (LST_max - LST_min).
    Low TCI = hot relative to history (heat stress); high TCI = cool relative to history."""
    month = date_obj.get("month")
    lst_col = ee.ImageCollection("MODIS/061/MOD11A1").select("LST_Day_1km")
    lst_month = lst_col.filter(ee.Filter.calendarRange(month, month, "month"))
    lst_min_max = lst_month.reduce(ee.Reducer.minMax())

    current_lst = lst_col.filterDate(date_obj.update(day=1), date_obj.advance(1, "month")).median()
    current_lst = ee.Image(
        ee.Algorithms.If(
            current_lst.bandNames().size(),
            current_lst,
            lst_col.filterDate(date_obj.advance(-1, "month"), date_obj).median(),
        )
    )

    # TCI = 100 * (LST_max - LST) / (LST_max - LST_min)
    tci = (
        lst_min_max.select("LST_Day_1km_max")
        .subtract(current_lst)
        .divide(
            lst_min_max.select("LST_Day_1km_max").subtract(lst_min_max.select("LST_Day_1km_min"))
        )
        .multiply(100)
        .rename("tci")
    )
    return tci.clip(somalia_geom)


def get_cdi_layer(date_str: str):
    """
    ICPAC-inspired CDI map layer (simplified linear composite, see risk_engine.py).
    4 indices: SPI-3 + VHI + SMI + SPEI, seasonally weighted.
    """
    require_gee()
    from app.services.risk_engine import (
        gee_compute_cdi,
        gee_normalize_smi,
        gee_normalize_spei,
        gee_normalize_spi,
        gee_normalize_vhi,
    )

    countries = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017")
    somalia = countries.filter(ee.Filter.eq("country_na", "Somalia")).geometry()

    date_ee = ee.Date(date_str)
    dt = datetime.strptime(date_str[:10], "%Y-%m-%d")
    month = dt.month

    # 1. SPI-3 (CHIRPS 3-month rolling)
    chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
    date_m1 = (dt - relativedelta(months=1)).strftime("%Y-%m-01")
    date_m2 = (dt - relativedelta(months=2)).strftime("%Y-%m-01")
    spi_img = (
        get_monthly_anomaly(chirps, "precipitation", date_str)
        .add(get_monthly_anomaly(chirps, "precipitation", date_m1))
        .add(get_monthly_anomaly(chirps, "precipitation", date_m2))
        .divide(math.sqrt(3))
    )

    # 2. VHI = 0.5*VCI + 0.5*TCI (MODIS NDVI + LST)
    vci = get_vci_image(date_ee, somalia)
    tci = get_tci_image(date_ee, somalia)
    vhi = vci.multiply(0.5).add(tci.multiply(0.5)).rename("vhi")

    # 3. SMI — FLDAS soil moisture anomaly (vs 1982–present)
    fldas = ee.ImageCollection("NASA/FLDAS/NOAH01/C/GL/M/V001")
    smi_img = get_monthly_anomaly(
        fldas, "SoilMoi00_10cm_tavg", date_str, climatology_start="1982-01-01"
    )

    # 4. SPEI — real P−PET water balance anomaly (ERA5-Land precip + potential evaporation)
    spei_img = get_water_balance_anomaly(date_str)

    # 5. ICPAC normalization (each → 0–1 stress scale)
    spi_stress = gee_normalize_spi(spi_img)
    vhi_stress = gee_normalize_vhi(vhi)
    smi_stress = gee_normalize_smi(smi_img)
    spei_stress = gee_normalize_spei(spei_img)

    # 6. Seasonal CDI composite
    cdi = gee_compute_cdi(spi_stress, vhi_stress, smi_stress, spei_stress, month).clip(somalia)

    cdi_palette = ["#05e100", "#ffff00", "#ff9900", "#ff0000", "#990000"]
    vis_params = {"min": 0, "max": 1, "palette": cdi_palette}
    return sanitize_url(cdi.getMapId(vis_params))


def get_cdi_timeseries(lat: float, lon: float):
    """
    ICPAC 4-index CDI timeseries: SPI-3 + VHI + SMI + SPEI, seasonally weighted.
    Returns normalized stress scores and composite CDI per month.
    """
    from app.services.risk_engine import (
        classify_cdi,
        compute_cdi,
        normalize_smi,
        normalize_spei,
        normalize_spi,
        normalize_vhi,
    )

    require_gee()
    point = ee.Geometry.Point([lon, lat])
    now = datetime.now()
    dates = sorted(
        list(
            set(
                [
                    (now.replace(day=1) - relativedelta(months=i)).strftime("%Y-%m-01")
                    for i in range(6)
                ]
            )
        )
    )
    results = []
    chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
    fldas = ee.ImageCollection("NASA/FLDAS/NOAH01/C/GL/M/V001")
    ndvi_col = ee.ImageCollection("MODIS/061/MOD13Q1").select("NDVI")
    lst_col = ee.ImageCollection("MODIS/061/MOD11A1").select("LST_Day_1km")
    for d_str in dates:
        try:
            dt = datetime.strptime(d_str[:10], "%Y-%m-%d")
            month = dt.month
            d1 = (dt - relativedelta(months=1)).strftime("%Y-%m-01")
            d2 = (dt - relativedelta(months=2)).strftime("%Y-%m-01")
            # SPI-3
            s0 = (
                get_monthly_anomaly(chirps, "precipitation", d_str)
                .reduceRegion(ee.Reducer.mean(), point, 5000)
                .get("anomaly")
                .getInfo()
            )
            s1 = (
                get_monthly_anomaly(chirps, "precipitation", d1)
                .reduceRegion(ee.Reducer.mean(), point, 5000)
                .get("anomaly")
                .getInfo()
            )
            s2 = (
                get_monthly_anomaly(chirps, "precipitation", d2)
                .reduceRegion(ee.Reducer.mean(), point, 5000)
                .get("anomaly")
                .getInfo()
            )
            spi_val = (
                (s0 + s1 + s2) / math.sqrt(3)
                if all(x is not None for x in [s0, s1, s2])
                else (s0 or 0)
            )
            # VHI (VCI + TCI from MODIS)
            date_ee = ee.Date(d_str)
            mm = date_ee.get("month")
            ndvi_mm = ndvi_col.filter(ee.Filter.calendarRange(mm, mm, "month"))
            ndvi_min_max = ndvi_mm.reduce(ee.Reducer.minMax())
            cur_ndvi = ndvi_col.filterDate(date_ee, date_ee.advance(1, "month")).median()
            vci_img = (
                cur_ndvi.subtract(ndvi_min_max.select("NDVI_min"))
                .divide(ndvi_min_max.select("NDVI_max").subtract(ndvi_min_max.select("NDVI_min")))
                .multiply(100)
            )
            lst_mm = lst_col.filter(ee.Filter.calendarRange(mm, mm, "month"))
            lst_min_max = lst_mm.reduce(ee.Reducer.minMax())
            cur_lst = lst_col.filterDate(date_ee, date_ee.advance(1, "month")).median()
            tci_img = (
                lst_min_max.select("LST_Day_1km_max")
                .subtract(cur_lst)
                .divide(
                    lst_min_max.select("LST_Day_1km_max").subtract(
                        lst_min_max.select("LST_Day_1km_min")
                    )
                )
                .multiply(100)
            )
            vhi_val = (
                vci_img.multiply(0.5)
                .add(tci_img.multiply(0.5))
                .reduceRegion(ee.Reducer.mean(), point, 1000)
                .get("NDVI")
                .getInfo()
            )
            # SMI
            smi_val = (
                get_monthly_anomaly(
                    fldas, "SoilMoi00_10cm_tavg", d_str, climatology_start="1982-01-01"
                )
                .reduceRegion(ee.Reducer.mean(), point, 10000)
                .get("anomaly")
                .getInfo()
            )
            # SPEI — real P−PET water balance anomaly
            spei_val = (
                get_water_balance_anomaly(d_str)
                .reduceRegion(ee.Reducer.mean(), point, 11132)
                .get("anomaly")
                .getInfo()
            )
            # ICPAC CDI composite
            cdi_val = compute_cdi(spi_val, vhi_val, smi_val, spei_val, month)
            classification = classify_cdi(cdi_val)
            results.append(
                {
                    "date": d_str,
                    "cdi": cdi_val,
                    "spi": round(normalize_spi(spi_val), 3),
                    "vhi": round(normalize_vhi(vhi_val), 3),
                    "smi": round(normalize_smi(smi_val), 3),
                    "spei": round(normalize_spei(spei_val), 3),
                    "status": classification["status"],
                    "color": classification["color"],
                }
            )
        except Exception as e:
            print(f"CDI timeseries error for {d_str}: {e}")
            continue
    return results


def get_spei_layer(date_str: str) -> str:
    """SPEI map layer — real P-PET water balance anomaly (see get_water_balance_anomaly)."""
    require_gee()
    spei = get_water_balance_anomaly(date_str)
    vis_params = {
        "min": -2.5,
        "max": 2.5,
        "palette": [
            "#67001f",
            "#b2182b",
            "#d6604d",
            "#f4a582",
            "#fddbc7",
            "#f7f7f7",
            "#d1e5f0",
            "#92c5de",
            "#4393c3",
            "#2166ac",
            "#053061",
        ],
    }
    return sanitize_url(spei.getMapId(vis_params))


def get_spei_timeseries(lat: float, lon: float) -> list[dict]:
    """12-month SPEI (real water-balance anomaly) point time series."""
    require_gee()
    point = ee.Geometry.Point([lon, lat])
    now = datetime.now()
    dates = [(now.replace(day=1) - relativedelta(months=i)).strftime("%Y-%m-01") for i in range(12)]
    results = []
    for d_str in sorted(list(set(dates))):
        try:
            val = (
                get_water_balance_anomaly(d_str)
                .reduceRegion(ee.Reducer.mean(), point, 11132)
                .get("anomaly")
                .getInfo()
            )
            if val is not None:
                results.append({"date": d_str, "value": round(val, 3)})
        except Exception as e:
            logger.warning(f"get_spei_timeseries: skipping {d_str}: {e}")
            continue
    return results


def get_gfs_forecast_timeseries(lat: float, lon: float, variable: str) -> list[dict]:
    """16-day NOAA GFS forecast time series at a point. `variable` is 'precip' (daily total
    rainfall, mm) or 'temp' (daily min/avg/max 2m air temperature, native Celsius)."""
    require_gee()
    point = ee.Geometry.Point([lon, lat])
    now = ee.Date(datetime.now().strftime("%Y-%m-%dT%H:%M:%S"))
    latest_run = ee.Image(
        ee.ImageCollection("NOAA/GFS0P25")
        .filterDate(now.advance(-3, "day"), now)
        .sort("system:time_start", False)
        .first()
    )
    init_time = latest_run.get("system:time_start")
    run_collection = ee.ImageCollection("NOAA/GFS0P25").filter(
        ee.Filter.eq("system:time_start", init_time)
    )
    band = "precipitation_rate" if variable == "precip" else "temperature_2m_above_ground"
    day_offsets = ee.List.sequence(0, 15)

    def process_day(day_offset):
        day_offset = ee.Number(day_offset)
        hour_start = day_offset.multiply(24)
        hour_end = day_offset.add(1).multiply(24)
        day_images = (
            run_collection.filter(ee.Filter.gte("forecast_hours", hour_start))
            .filter(ee.Filter.lt("forecast_hours", hour_end))
            .select(band)
        )
        date_str = ee.Date(init_time).advance(day_offset, "day").format("YYYY-MM-dd")
        if variable == "temp":
            stats = day_images.mean().reduceRegion(ee.Reducer.mean(), point, 27000)
            return ee.Algorithms.If(
                day_images.size().gt(0),
                ee.Feature(
                    None,
                    {
                        "date": date_str,
                        "avg": stats.get(band),
                        "min": day_images.min()
                        .reduceRegion(ee.Reducer.min(), point, 27000)
                        .get(band),
                        "max": day_images.max()
                        .reduceRegion(ee.Reducer.max(), point, 27000)
                        .get(band),
                        "valid": 1,
                    },
                ),
                ee.Feature(None, {"date": date_str, "valid": 0}),
            )
        else:
            total_mm = ee.Number(
                day_images.mean().reduceRegion(ee.Reducer.mean(), point, 27000).get(band)
            ).multiply(86400)
            return ee.Algorithms.If(
                day_images.size().gt(0),
                ee.Feature(None, {"date": date_str, "value": total_mm, "valid": 1}),
                ee.Feature(None, {"date": date_str, "valid": 0}),
            )

    data = (
        ee.FeatureCollection(day_offsets.map(process_day))
        .filter(ee.Filter.eq("valid", 1))
        .getInfo()
    )
    results = []
    for feat in data["features"]:
        props = feat["properties"]
        row = {"date": props["date"]}
        if variable == "temp":
            row.update(
                {
                    "min": round(props["min"], 2) if props["min"] is not None else None,
                    "avg": round(props["avg"], 2) if props["avg"] is not None else None,
                    "max": round(props["max"], 2) if props["max"] is not None else None,
                }
            )
        else:
            row["value"] = round(props["value"], 2) if props["value"] is not None else None
        if (variable == "temp" and row["avg"] is not None) or (
            variable != "temp" and row["value"] is not None
        ):
            results.append(row)
    return results


def get_temperature_timeseries(
    lat: float, lon: float, start_date: str, end_date: str
) -> list[dict]:
    """Daily MODIS land-surface temperature (min/avg/max, °C) at a point over the period."""
    require_gee()
    point = ee.Geometry.Point([lon, lat])
    collection = (
        ee.ImageCollection("MODIS/061/MOD11A1").filterDate(start_date, end_date).filterBounds(point)
    )

    def set_temp_and_date(image):
        temp = image.select("LST_Day_1km").multiply(0.02).subtract(273.15)
        stats = temp.reduceRegion(
            ee.Reducer.min()
            .combine(ee.Reducer.mean(), sharedInputs=True)
            .combine(ee.Reducer.max(), sharedInputs=True),
            point.buffer(5000),
            1000,
        )
        return ee.Feature(
            None,
            {
                "avg": stats.get("LST_Day_1km_mean"),
                "min": stats.get("LST_Day_1km_min"),
                "max": stats.get("LST_Day_1km_max"),
                "date": image.date().format("YYYY-MM-dd"),
            },
        )

    data_list = (
        collection.map(set_temp_and_date)
        .filter(ee.Filter.notNull(["avg"]))
        .sort("date")
        .limit(365)
        .getInfo()
    )
    return [
        {
            "date": f["properties"]["date"],
            "avg": f["properties"]["avg"],
            "min": f["properties"]["min"],
            "max": f["properties"]["max"],
        }
        for f in data_list["features"]
    ]


def get_smi_timeseries(lat: float, lon: float) -> list[dict]:
    """12-month soil moisture anomaly (FLDAS, vs 1982-present climatology) at a point."""
    require_gee()
    point = ee.Geometry.Point([lon, lat])
    now = datetime.now()
    dates = [(now.replace(day=1) - relativedelta(months=i)).strftime("%Y-%m-01") for i in range(12)]
    results = []
    fldas = ee.ImageCollection("NASA/FLDAS/NOAH01/C/GL/M/V001")
    for d_str in sorted(list(set(dates))):
        try:
            val = (
                get_monthly_anomaly(
                    fldas, "SoilMoi00_10cm_tavg", d_str, climatology_start="1982-01-01"
                )
                .reduceRegion(ee.Reducer.mean(), point, 10000)
                .get("anomaly")
                .getInfo()
            )
            if val is not None:
                results.append({"date": d_str, "value": round(val, 3)})
        except Exception as e:
            logger.warning(f"get_smi_timeseries: skipping {d_str}: {e}")
            continue
    return results


def get_temperature_layer(start_date: str, end_date: str) -> str:
    """MODIS land-surface temperature map layer (°C, mean over the period)."""
    require_gee()
    countries = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017")
    somalia = countries.filter(ee.Filter.eq("country_na", "Somalia"))
    collection = (
        ee.ImageCollection("MODIS/061/MOD11A1")
        .filterDate(start_date, end_date)
        .filterBounds(somalia)
    )
    if collection.size().getInfo() == 0:
        latest = ee.ImageCollection("MODIS/061/MOD11A1").sort("system:time_start", False).first()
        collection = (
            ee.ImageCollection("MODIS/061/MOD11A1")
            .filterDate(
                ee.Date(latest.get("system:time_start")).advance(-5, "day"),
                ee.Date(latest.get("system:time_start")).advance(1, "day"),
            )
            .filterBounds(somalia)
        )

    def to_celsius(image):
        return image.select("LST_Day_1km").multiply(0.02).subtract(273.15).rename("temp")

    image = collection.map(to_celsius).select("temp").mean().clip(somalia)
    vis_params = {
        "min": 20,
        "max": 50,
        "palette": ["0000ff", "00ffff", "ffff00", "ff0000", "df0000"],
    }
    return sanitize_url(image.getMapId(vis_params))


def get_gfs_forecast_layer(variable: str, days: int) -> str:
    """NOAA GFS forecast map layer over the next `days` days. `variable` is 'precip'
    (cumulative rainfall, SWALIM-classified) or 'temp' (max 2m air temperature, native °C)."""
    require_gee()
    countries = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017")
    somalia = countries.filter(ee.Filter.eq("country_na", "Somalia"))
    now = ee.Date(datetime.now().strftime("%Y-%m-%dT%H:%M:%S"))
    latest_run = ee.Image(
        ee.ImageCollection("NOAA/GFS0P25")
        .filterDate(now.advance(-3, "day"), now)
        .sort("system:time_start", False)
        .first()
    )
    init_time = latest_run.get("system:time_start")
    forecast_collection = (
        ee.ImageCollection("NOAA/GFS0P25")
        .filter(ee.Filter.eq("system:time_start", init_time))
        .filter(ee.Filter.lte("forecast_hours", days * 24))
    )
    if variable == "precip":
        precip = (
            forecast_collection.select("precipitation_rate")
            .mean()
            .multiply(3600 * days * 24)
            .clip(somalia)
        )
        image = classify_swalim_rainfall(precip).clip(somalia)
        vis_params = {"min": 0, "max": 10, "palette": SWALIM_RAINFALL_PALETTE}
    else:
        image = forecast_collection.select("temperature_2m_above_ground").max().clip(somalia)
        vis_params = {
            "min": 20,
            "max": 45,
            "palette": ["0000ff", "00ffff", "ffff00", "ff0000", "df0000"],
        }
    return sanitize_url(image.getMapId(vis_params))


def get_smi_layer(date_str: str) -> str:
    """Soil moisture anomaly map layer (FLDAS, vs 1982-present climatology)."""
    require_gee()
    fldas = ee.ImageCollection("NASA/FLDAS/NOAH01/C/GL/M/V001")
    smdi = get_monthly_anomaly(
        fldas, "SoilMoi00_10cm_tavg", date_str, climatology_start="1982-01-01"
    )
    vis_params = {
        "min": -2,
        "max": 2,
        "palette": [
            "#a50026",
            "#d73027",
            "#f46d43",
            "#fdae61",
            "#fee090",
            "#e0f3f8",
            "#abd9e9",
            "#74add1",
            "#4575b4",
            "#313695",
        ],
        "crs": "EPSG:4326",
    }
    return sanitize_url(smdi.getMapId(vis_params))


def get_spi_layer(date_str: str) -> str:
    """SPI map layer — standardized CHIRPS rainfall anomaly vs 1991-2020 climatology."""
    require_gee()
    chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
    spi = get_monthly_anomaly(chirps, "precipitation", date_str)
    vis_params = {
        "min": -2,
        "max": 2,
        "palette": [
            "#a50026",
            "#d73027",
            "#f46d43",
            "#fdae61",
            "#fee090",
            "#e0f3f8",
            "#abd9e9",
            "#74add1",
            "#4575b4",
            "#313695",
        ],
        "crs": "EPSG:4326",
    }
    return sanitize_url(spi.getMapId(vis_params))


def get_spi_timeseries(lat: float, lon: float) -> list[dict]:
    """12-month SPI point time series."""
    require_gee()
    point = ee.Geometry.Point([lon, lat])
    chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
    now = datetime.now()
    # Fetch last 12 months
    dates = [(now.replace(day=1) - relativedelta(months=i)).strftime("%Y-%m-01") for i in range(12)]
    results = []
    for d_str in sorted(list(set(dates))):
        try:
            val = (
                get_monthly_anomaly(chirps, "precipitation", d_str)
                .reduceRegion(ee.Reducer.mean(), point, 5000)
                .get("anomaly")
                .getInfo()
            )
            if val is not None:
                results.append({"date": d_str, "value": round(val, 3)})
        except Exception as e:
            logger.warning(f"get_spi_timeseries: skipping {d_str}: {e}")
            continue
    return results


def get_vhi_layer(date_str: str) -> str:
    """VHI map layer: 0.5*VCI + 0.5*TCI (Kogan's standard weighting), computed inline
    here rather than via get_vci_image/get_tci_image (small historical duplication)."""
    require_gee()
    date = ee.Date(date_str)
    month = date.get("month")

    countries = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017")
    somalia = countries.filter(ee.Filter.eq("country_na", "Somalia")).geometry()

    # 1. VCI (from MODIS NDVI)
    ndvi_col = ee.ImageCollection("MODIS/061/MOD13Q1").select("NDVI")
    ndvi_month = ndvi_col.filter(ee.Filter.calendarRange(month, month, "month"))
    ndvi_min_max = ndvi_month.reduce(ee.Reducer.minMax())

    current_ndvi = ndvi_col.filterDate(date.update(day=1), date.advance(1, "month")).median()
    # Fallback to current year median if no data for month (e.g. current month)
    current_ndvi = ee.Algorithms.If(
        current_ndvi.bandNames().size(),
        current_ndvi,
        ndvi_col.filterDate(date.advance(-1, "month"), date).median(),
    )
    current_ndvi = ee.Image(current_ndvi)

    vci = (
        current_ndvi.subtract(ndvi_min_max.select("NDVI_min"))
        .divide(ndvi_min_max.select("NDVI_max").subtract(ndvi_min_max.select("NDVI_min")))
        .multiply(100)
        .rename("vci")
    )

    # 2. TCI (from MODIS LST)
    lst_col = ee.ImageCollection("MODIS/061/MOD11A1").select("LST_Day_1km")
    lst_month = lst_col.filter(ee.Filter.calendarRange(month, month, "month"))
    lst_min_max = lst_month.reduce(ee.Reducer.minMax())

    # MODIS LST uses 0.02 scale
    current_lst = lst_col.filterDate(date.update(day=1), date.advance(1, "month")).median()
    current_lst = ee.Algorithms.If(
        current_lst.bandNames().size(),
        current_lst,
        lst_col.filterDate(date.advance(-1, "month"), date).median(),
    )
    current_lst = ee.Image(current_lst)

    # TCI = 100 * (LST_max - LST) / (LST_max - LST_min)
    tci = (
        lst_min_max.select("LST_Day_1km_max")
        .subtract(current_lst)
        .divide(
            lst_min_max.select("LST_Day_1km_max").subtract(lst_min_max.select("LST_Day_1km_min"))
        )
        .multiply(100)
        .rename("tci")
    )

    # 3. VHI
    vhi = vci.multiply(0.5).add(tci.multiply(0.5)).rename("vhi").clip(somalia)

    vis_params = {
        "min": 0,
        "max": 100,
        "palette": [
            "#a50026",
            "#d73027",
            "#f46d43",
            "#fdae61",
            "#fee08b",
            "#d9ef8b",
            "#a6d96a",
            "#66bd63",
            "#1a9850",
            "#006837",
        ],
    }
    return sanitize_url(vhi.getMapId(vis_params))


def get_vhi_timeseries(lat: float, lon: float) -> list[dict]:
    """12-month VHI point time series."""
    require_gee()
    point = ee.Geometry.Point([lon, lat])
    now = datetime.now()
    dates = [(now.replace(day=1) - relativedelta(months=i)).strftime("%Y-%m-01") for i in range(12)]
    results = []

    # We pre-calculate vhi for these dates
    for d_str in sorted(list(set(dates))):
        try:
            # Re-use logic or call it for point
            date = ee.Date(d_str)
            month = date.get("month")

            # Limited collections for point reduction
            ndvi_col = ee.ImageCollection("MODIS/061/MOD13Q1").select("NDVI")
            ndvi_min_max = ndvi_col.filter(ee.Filter.calendarRange(month, month, "month")).reduce(
                ee.Reducer.minMax()
            )
            current_ndvi = ndvi_col.filterDate(date, date.advance(1, "month")).median()
            vci = current_ndvi.subtract(ndvi_min_max.select("NDVI_min")).divide(
                ndvi_min_max.select("NDVI_max").subtract(ndvi_min_max.select("NDVI_min"))
            )

            lst_col = ee.ImageCollection("MODIS/061/MOD11A1").select("LST_Day_1km")
            lst_min_max = lst_col.filter(ee.Filter.calendarRange(month, month, "month")).reduce(
                ee.Reducer.minMax()
            )
            current_lst = lst_col.filterDate(date, date.advance(1, "month")).median()
            tci = (
                lst_min_max.select("LST_Day_1km_max")
                .subtract(current_lst)
                .divide(
                    lst_min_max.select("LST_Day_1km_max").subtract(
                        lst_min_max.select("LST_Day_1km_min")
                    )
                )
            )

            vhi_val = (
                vci.multiply(0.5)
                .add(tci.multiply(0.5))
                .multiply(100)
                .reduceRegion(ee.Reducer.mean(), point, 1000)
                .get("NDVI")
                .getInfo()
            )
            # Note: the rename in vhi logic might result in 'NDVI' or 'vhi' band name depending on reducer,
            # but usually it takes the name of the first band if not specified.
            if vhi_val is None:  # try other common name
                vhi_val = (
                    vci.multiply(0.5)
                    .add(tci.multiply(0.5))
                    .multiply(100)
                    .reduceRegion(ee.Reducer.mean(), point, 1000)
                    .get("vci")
                    .getInfo()
                )

            if vhi_val is not None:
                results.append({"date": d_str, "value": round(vhi_val, 2)})
        except Exception as e:
            logger.warning(f"get_vhi_timeseries: skipping {d_str}: {e}")
            continue
    return results


def get_temp_anomaly_layer(date_str: str) -> str:
    """Standardized MODIS LST anomaly map layer vs 2000-present climatology."""
    require_gee()
    lst_col = ee.ImageCollection("MODIS/061/MOD11A1")
    anomaly = get_monthly_anomaly(lst_col, "LST_Day_1km", date_str, climatology_start="2000-01-01")
    vis_params = {
        "min": -2,
        "max": 2,
        "palette": [
            "#313695",
            "#4575b4",
            "#74add1",
            "#abd9e9",
            "#e0f3f8",
            "#ffffbf",
            "#fee090",
            "#fdae61",
            "#f46d43",
            "#d73027",
            "#a50026",
        ],
        "crs": "EPSG:4326",
    }
    return sanitize_url(anomaly.getMapId(vis_params))


def get_temp_anomaly_timeseries(lat: float, lon: float) -> list[dict]:
    """12-month temperature anomaly point time series (MODIS LST vs 2000-present)."""
    require_gee()
    point = ee.Geometry.Point([lon, lat])
    lst_col = ee.ImageCollection("MODIS/061/MOD11A1")
    now = datetime.now()
    dates = [(now.replace(day=1) - relativedelta(months=i)).strftime("%Y-%m-01") for i in range(12)]
    results = []
    for d_str in sorted(list(set(dates))):
        try:
            val = (
                get_monthly_anomaly(lst_col, "LST_Day_1km", d_str, climatology_start="2000-01-01")
                .reduceRegion(ee.Reducer.mean(), point, 1000)
                .get("anomaly")
                .getInfo()
            )
            if val is not None:
                results.append({"date": d_str, "value": round(val, 3)})
        except Exception as e:
            logger.warning(f"get_temp_anomaly_timeseries: skipping {d_str}: {e}")
            continue
    return results


def get_tci_layer(date_str: str) -> str:
    """TCI map layer (see get_tci_image for the formula), computed inline for the full
    Somalia extent."""
    require_gee()
    date = ee.Date(date_str)
    month = date.get("month")

    countries = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017")
    somalia = countries.filter(ee.Filter.eq("country_na", "Somalia")).geometry()

    lst_col = ee.ImageCollection("MODIS/061/MOD11A1").select("LST_Day_1km")
    lst_month = lst_col.filter(ee.Filter.calendarRange(month, month, "month"))
    lst_min_max = lst_month.reduce(ee.Reducer.minMax())

    current_lst = lst_col.filterDate(date.update(day=1), date.advance(1, "month")).median()
    current_lst = ee.Algorithms.If(
        current_lst.bandNames().size(),
        current_lst,
        lst_col.filterDate(date.advance(-1, "month"), date).median(),
    )
    current_lst = ee.Image(current_lst)

    # TCI = 100 * (LST_max - LST) / (LST_max - LST_min)
    tci = (
        lst_min_max.select("LST_Day_1km_max")
        .subtract(current_lst)
        .divide(
            lst_min_max.select("LST_Day_1km_max").subtract(lst_min_max.select("LST_Day_1km_min"))
        )
        .multiply(100)
        .rename("tci")
        .clip(somalia)
    )

    vis_params = {
        "min": 0,
        "max": 100,
        "palette": [
            "#a50026",
            "#d73027",
            "#f46d43",
            "#fdae61",
            "#fee08b",
            "#d9ef8b",
            "#a6d96a",
            "#66bd63",
            "#1a9850",
            "#006837",
        ],
    }
    return sanitize_url(tci.getMapId(vis_params))


def get_tci_timeseries(lat: float, lon: float) -> list[dict]:
    """12-month TCI point time series."""
    require_gee()
    point = ee.Geometry.Point([lon, lat])
    now = datetime.now()
    dates = [(now.replace(day=1) - relativedelta(months=i)).strftime("%Y-%m-01") for i in range(12)]
    results = []

    lst_col = ee.ImageCollection("MODIS/061/MOD11A1").select("LST_Day_1km")

    for d_str in sorted(list(set(dates))):
        try:
            date = ee.Date(d_str)
            month = date.get("month")
            lst_min_max = lst_col.filter(ee.Filter.calendarRange(month, month, "month")).reduce(
                ee.Reducer.minMax()
            )
            current_lst = lst_col.filterDate(date, date.advance(1, "month")).median()

            tci = (
                lst_min_max.select("LST_Day_1km_max")
                .subtract(current_lst)
                .divide(
                    lst_min_max.select("LST_Day_1km_max").subtract(
                        lst_min_max.select("LST_Day_1km_min")
                    )
                )
                .multiply(100)
                .rename("tci")
            )

            tci_val = tci.reduceRegion(ee.Reducer.mean(), point, 1000).get("tci").getInfo()
            if tci_val is not None:
                results.append({"date": d_str, "value": round(tci_val, 2)})
        except Exception as e:
            logger.warning(f"get_tci_timeseries: skipping {d_str}: {e}")
            continue
    return results


def mask_s2_clouds(image):
    """Mask out Sentinel-2 cloud/shadow/cirrus pixels using the SCL band."""
    scl = image.select("SCL")
    # 3: shadow, 8, 9: clouds, 10: cirrus
    mask = scl.neq(3).And(scl.neq(8)).And(scl.neq(9)).And(scl.neq(10))
    return image.updateMask(mask)


def get_bsi_layer(date_str: str) -> str:
    """Bare Soil Index map layer (Sentinel-2 SR, cloud-masked, NDVI<0.35 vegetation mask)."""
    require_gee()
    date = ee.Date(date_str)

    countries = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017")
    somalia = countries.filter(ee.Filter.eq("country_na", "Somalia")).geometry()

    collection = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterDate(date.update(day=1), date.advance(1, "month"))
        .filterBounds(somalia)
        .map(mask_s2_clouds)
    )

    if collection.size().getInfo() == 0:
        collection = (
            ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
            .filterDate(date.advance(-1, "month"), date)
            .filterBounds(somalia)
            .map(mask_s2_clouds)
        )

    image = collection.median().clip(somalia)

    swir = image.select("B11")
    red = image.select("B4")
    nir = image.select("B8")
    blue = image.select("B2")

    bsi = (
        swir.add(red).subtract(nir.add(blue)).divide(swir.add(red).add(nir.add(blue))).rename("bsi")
    )

    # Relaxed mask: ensure we see transition areas
    ndvi = image.normalizedDifference(["B8", "B4"])
    bsi = bsi.updateMask(ndvi.lt(0.35))

    vis_params = {
        "min": -0.05,
        "max": 0.3,
        "palette": ["#1b5e20", "#aed581", "#ffeb3b", "#ff9800", "#e65100", "#3e2723"],
        "crs": "EPSG:4326",
    }
    return sanitize_url(bsi.getMapId(vis_params))


def get_bsi_timeseries(lat: float, lon: float) -> list[dict]:
    """12-month Bare Soil Index point time series (Sentinel-2 SR)."""
    require_gee()
    point = ee.Geometry.Point([lon, lat])
    now = datetime.now()
    dates = [(now.replace(day=1) - relativedelta(months=i)).strftime("%Y-%m-01") for i in range(12)]
    results = []

    s2_col = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED").select(
        ["B11", "B4", "B8", "B2", "SCL"]
    )

    for d_str in sorted(list(set(dates))):
        try:
            date = ee.Date(d_str)
            filtered = (
                s2_col.filterDate(date, date.advance(1, "month"))
                .filterBounds(point)
                .map(mask_s2_clouds)
            )
            if filtered.size().getInfo() == 0:
                continue

            image = filtered.median()
            swir = image.select("B11")
            red = image.select("B4")
            nir = image.select("B8")
            blue = image.select("B2")
            bsi = (
                swir.add(red)
                .subtract(nir.add(blue))
                .divide(swir.add(red).add(nir.add(blue)))
                .rename("bsi")
            )

            val = bsi.reduceRegion(ee.Reducer.mean(), point, 20).get("bsi").getInfo()
            if val is not None:
                results.append({"date": d_str, "value": round(val, 3)})
        except Exception as e:
            logger.warning(f"get_bsi_timeseries: skipping {d_str}: {e}")
            continue
    return results


def get_drought_stats(date_str: str = None) -> dict:
    """National CDI summary + per-district hotspot table (used by /api/drought/stats),
    using the same ICPAC-inspired 4-index CDI as get_cdi_layer for consistency."""
    require_gee()
    from app.services.risk_engine import (
        gee_compute_cdi,
        gee_normalize_smi,
        gee_normalize_spei,
        gee_normalize_spi,
        gee_normalize_vhi,
    )

    if not date_str:
        date_str = datetime.now().strftime("%Y-%m-01")

    dt = datetime.strptime(date_str[:10], "%Y-%m-%d")
    date_ee = ee.Date(date_str)
    month = dt.month
    season = get_season_info(month)

    countries = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017")
    somalia = countries.filter(ee.Filter.eq("country_na", "Somalia")).geometry()

    # 1. Inputs — same ICPAC 4-index composite used by the CDI map layer
    # (SPI-3 + VHI + SMI + SPEI), so this endpoint agrees with get_cdi_layer.
    chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
    date_m1 = (dt - relativedelta(months=1)).strftime("%Y-%m-01")
    date_m2 = (dt - relativedelta(months=2)).strftime("%Y-%m-01")

    spi3 = (
        get_monthly_anomaly(chirps, "precipitation", date_str)
        .add(get_monthly_anomaly(chirps, "precipitation", date_m1))
        .add(get_monthly_anomaly(chirps, "precipitation", date_m2))
        .divide(math.sqrt(3))
    )
    vci = get_vci_image(date_ee, somalia)
    tci = get_tci_image(date_ee, somalia)
    vhi = vci.multiply(0.5).add(tci.multiply(0.5)).rename("vhi")

    fldas = ee.ImageCollection("NASA/FLDAS/NOAH01/C/GL/M/V001")
    smi_img = get_monthly_anomaly(
        fldas, "SoilMoi00_10cm_tavg", date_str, climatology_start="1982-01-01"
    )
    spei_img = get_water_balance_anomaly(date_str)

    spi_stress = gee_normalize_spi(spi3)
    vhi_stress = gee_normalize_vhi(vhi)
    smi_stress = gee_normalize_smi(smi_img)
    spei_stress = gee_normalize_spei(spei_img)

    cdi = gee_compute_cdi(spi_stress, vhi_stress, smi_stress, spei_stress, month)

    # 2. Aggregate by Districts (Level 2)
    districts = ee.FeatureCollection("FAO/GAUL/2015/level2").filter(
        ee.Filter.eq("ADM0_NAME", "Somalia")
    )
    stats = cdi.reduceRegions(collection=districts, reducer=ee.Reducer.mean(), scale=5000)
    data = (
        stats.filter(ee.Filter.notNull(["mean"]))
        .select(["ADM1_NAME", "ADM2_NAME", "mean"])
        .getInfo()
    )

    # 3. Process results
    results = []
    hotspots = []
    total_severe = 0

    for feat in data["features"]:
        props = feat["properties"]
        val = props.get("mean", 0)
        status = "Normal"
        color = "#05e100"
        if val > 0.8:
            status = "Extreme"
            color = "#990000"
            total_severe += 1
        elif val > 0.6:
            status = "Severe"
            color = "#ff0000"
            total_severe += 1
        elif val > 0.4:
            status = "Moderate"
            color = "#ff9900"
        elif val > 0.2:
            status = "Watch"
            color = "#ffff00"

        item = {
            "district": props.get("ADM2_NAME"),
            "region": props.get("ADM1_NAME"),
            "cdi": round(val, 3),
            "status": status,
            "color": color,
        }
        results.append(item)
        if val > 0.4:
            hotspots.append(item)

    hotspots.sort(key=lambda x: x["cdi"], reverse=True)

    # Summary components
    spi_mean = spi3.reduceRegion(ee.Reducer.mean(), somalia, 10000).get("anomaly").getInfo() or 0
    vci_mean = vci.reduceRegion(ee.Reducer.mean(), somalia, 10000).get("vci").getInfo() or 0
    tci_mean = tci.reduceRegion(ee.Reducer.mean(), somalia, 10000).get("tci").getInfo() or 0

    summary_text = f"{season['name']} season context: "
    if total_severe > 0:
        top_regions = list(set([h["region"] for h in hotspots[:3]]))
        summary_text += f"Severe conditions detected in {', '.join(top_regions)}."
    elif spi_mean < -0.5:
        summary_text += "Below-normal rainfall performance observed."
    else:
        summary_text += "Conditions remain generally normal for this period."

    return {
        "season": season["name"],
        "summary": summary_text,
        "rainfall_status": "Below Normal" if spi_mean < -0.5 else "Normal",
        "vegetation_status": "Stressed" if vci_mean < 40 else "Healthy",
        "heat_status": "High" if tci_mean < 40 else "Normal",
        "hotspots": hotspots[:10],
        "all_districts": results,
    }


def get_multi_index_context(
    scope_level: str, scope_name: str, layer_type: str, target_date_str: str = None
) -> dict:
    """Fetch all real index values (SPI, VCI, TCI, VHI, CDI, soil moisture, SPEI, previous
    season performance, trend) for a scope — the grounding data passed into the AI insights
    prompt (see app/routers/insights.py)."""
    require_gee()

    if scope_level == "national":
        countries = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017")
        geom = countries.filter(ee.Filter.eq("country_na", "Somalia")).geometry()
    elif scope_level == "region":
        regions = ee.FeatureCollection("FAO/GAUL/2015/level1")
        geom = regions.filter(ee.Filter.eq("ADM1_NAME", scope_name)).geometry()
    else:  # district
        districts = ee.FeatureCollection("FAO/GAUL/2015/level2")
        geom = districts.filter(ee.Filter.eq("ADM2_NAME", scope_name)).geometry()

    if target_date_str:
        date_str = target_date_str
    else:
        date_str = datetime.now().strftime("%Y-%m-01")

    dt = datetime.strptime(date_str[:10], "%Y-%m-%d")
    date_ee = ee.Date(date_str)
    month = dt.month
    season = get_season_info(month)

    # Base return dict
    context = {
        "region": scope_name,
        "insight_type": layer_type,
        "season": season["name"],
        "previous_season_performance": "unknown",  # To be determined
    }

    # Fetch relevant data based on layer_type
    try:
        chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")

        # -----------------------------------------------------------
        # 1. Current month SPI (vs 1991-2020 CHIRPS climatology)
        # -----------------------------------------------------------
        spi1 = (
            get_monthly_anomaly(chirps, "precipitation", date_str)
            .reduceRegion(ee.Reducer.mean(), geom, 5000)
            .get("anomaly")
            .getInfo()
            or 0
        )
        context["spi"] = round(spi1, 2)

        # -----------------------------------------------------------
        # 2. Previous COMPLETED rainy season — average SPI over all
        #    3 months of that season (not just a single month entry).
        #    Always references the last COMPLETED season:
        #      Jan-Jun  → Deyr of the previous year (Oct-Dec)
        #      Jul-Dec  → Gu of the current year    (Apr-Jun)
        # -----------------------------------------------------------
        if month in [1, 2, 3, 4, 5, 6]:
            prev_months = [
                f"{dt.year - 1}-10-01",
                f"{dt.year - 1}-11-01",
                f"{dt.year - 1}-12-01",
            ]
            prev_season_label = f"Deyr {dt.year - 1}"

            prev2_months = [
                f"{dt.year - 1}-04-01",
                f"{dt.year - 1}-05-01",
                f"{dt.year - 1}-06-01",
            ]
            prev2_season_label = f"Gu {dt.year - 1}"
        else:
            prev_months = [
                f"{dt.year}-04-01",
                f"{dt.year}-05-01",
                f"{dt.year}-06-01",
            ]
            prev_season_label = f"Gu {dt.year}"

            prev2_months = [
                f"{dt.year - 1}-10-01",
                f"{dt.year - 1}-11-01",
                f"{dt.year - 1}-12-01",
            ]
            prev2_season_label = f"Deyr {dt.year - 1}"

        prev_spis = []
        for pm in prev_months:
            try:
                v = (
                    get_monthly_anomaly(chirps, "precipitation", pm)
                    .reduceRegion(ee.Reducer.mean(), geom, 5000)
                    .get("anomaly")
                    .getInfo()
                )
                if v is not None:
                    prev_spis.append(v)
            except Exception:
                pass
        prev_spi_mean = sum(prev_spis) / len(prev_spis) if prev_spis else 0

        prev2_spis = []
        for pm in prev2_months:
            try:
                v = (
                    get_monthly_anomaly(chirps, "precipitation", pm)
                    .reduceRegion(ee.Reducer.mean(), geom, 5000)
                    .get("anomaly")
                    .getInfo()
                )
                if v is not None:
                    prev2_spis.append(v)
            except Exception:
                pass
        prev2_spi_mean = sum(prev2_spis) / len(prev2_spis) if prev2_spis else 0

        context["previous_season_performance"] = (
            "below normal"
            if prev_spi_mean < -0.5
            else ("above normal" if prev_spi_mean > 0.5 else "normal")
        )
        context["previous_season_label"] = prev_season_label
        context["previous_season_spi"] = round(prev_spi_mean, 2)

        context["prev2_season_performance"] = (
            "below normal"
            if prev2_spi_mean < -0.5
            else ("above normal" if prev2_spi_mean > 0.5 else "normal")
        )
        context["prev2_season_label"] = prev2_season_label
        context["prev2_season_spi"] = round(prev2_spi_mean, 2)

        # -----------------------------------------------------------
        # 3. Real 3-month rainfall trend (improving / stable / worsening)
        #    Compare current SPI against average of the 2 prior months.
        # -----------------------------------------------------------
        spi_prev1_str = (dt - relativedelta(months=1)).strftime("%Y-%m-01")
        spi_prev2_str = (dt - relativedelta(months=2)).strftime("%Y-%m-01")
        sp1, sp2 = 0.0, 0.0
        try:
            sp1 = (
                get_monthly_anomaly(chirps, "precipitation", spi_prev1_str)
                .reduceRegion(ee.Reducer.mean(), geom, 5000)
                .get("anomaly")
                .getInfo()
                or 0
            )
            sp2 = (
                get_monthly_anomaly(chirps, "precipitation", spi_prev2_str)
                .reduceRegion(ee.Reducer.mean(), geom, 5000)
                .get("anomaly")
                .getInfo()
                or 0
            )
            diff = spi1 - ((sp1 + sp2) / 2)
            trend = "improving" if diff > 0.3 else ("worsening" if diff < -0.3 else "stable")
        except Exception:
            trend = "stable"
        context["trend"] = trend
        context["spi_3month_series"] = {
            "current": round(spi1, 2),
            "prev_1mo": round(sp1, 2),
            "prev_2mo": round(sp2, 2),
        }

        # -----------------------------------------------------------
        # 4. VCI, TCI, VHI (MODIS NDVI + LST)
        # -----------------------------------------------------------
        vci_img = get_vci_image(date_ee, geom)
        vci_val = vci_img.reduceRegion(ee.Reducer.mean(), geom, 5000).get("vci").getInfo() or 0
        context["vci"] = round(vci_val, 2)
        context["vegetation_condition"] = "stressed" if vci_val < 40 else "healthy"

        tci_img = get_tci_image(date_ee, geom)
        tci_val = tci_img.reduceRegion(ee.Reducer.mean(), geom, 5000).get("tci").getInfo() or 0
        context["tci"] = round(tci_val, 2)

        # VHI = 0.5*VCI + 0.5*TCI (ICPAC standard)
        vhi_val = 0.5 * vci_val + 0.5 * tci_val
        context["vhi"] = round(vhi_val, 2)

        # -----------------------------------------------------------
        # 5. SMI — always fetched (needed for ICPAC CDI composite)
        # -----------------------------------------------------------
        fldas = ee.ImageCollection("NASA/FLDAS/NOAH01/C/GL/M/V001")
        smi_val = (
            get_monthly_anomaly(
                fldas, "SoilMoi00_10cm_tavg", date_str, climatology_start="1982-01-01"
            )
            .reduceRegion(ee.Reducer.mean(), geom, 10000)
            .get("anomaly")
            .getInfo()
            or 0
        )
        context["soil_moisture"] = round(smi_val, 2)

        # -----------------------------------------------------------
        # 6. SPEI — real P−PET water balance anomaly (needed for ICPAC CDI composite)
        # -----------------------------------------------------------
        spei_val = (
            get_water_balance_anomaly(date_str)
            .reduceRegion(ee.Reducer.mean(), geom, 11132)
            .get("anomaly")
            .getInfo()
            or 0
        )
        context["spei"] = round(spei_val, 2)

        # -----------------------------------------------------------
        # 7. ICPAC normalized_scores — always computed for Intelligence Dashboard
        # -----------------------------------------------------------
        from app.services.risk_engine import (
            classify_cdi,
            compute_cdi,
            get_seasonal_weights,
            normalize_smi,
            normalize_spei,
            normalize_spi,
            normalize_vhi,
        )

        spi_s = normalize_spi(spi1)
        vhi_s = normalize_vhi(vhi_val)
        smi_s = normalize_smi(smi_val)
        spei_s = normalize_spei(spei_val)
        cdi_val = compute_cdi(spi1, vhi_val, smi_val, spei_val, month)
        classification = classify_cdi(cdi_val)
        context["cdi"] = cdi_val
        context["normalized_scores"] = {
            "spi_stress": round(spi_s, 3),
            "vhi_stress": round(vhi_s, 3),
            "smi_stress": round(smi_s, 3),
            "spei_stress": round(spei_s, 3),
            "cdi": cdi_val,
            "status": classification["status"],
            "color": classification["color"],
            "season": season["name"],
            "season_type": season["type"],
            "weights": get_seasonal_weights(month),
        }

        # -----------------------------------------------------------
        # 8. Layer-specific extras (what the user is currently viewing)
        # -----------------------------------------------------------
        if layer_type == "bsi":
            img = (
                ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                .filterDate(date_ee.update(day=1), date_ee.advance(1, "month"))
                .filterBounds(geom)
                .map(mask_s2_clouds)
                .median()
            )
            swir = img.select("B11")
            red = img.select("B4")
            nir = img.select("B8")
            blue = img.select("B2")
            bsi = swir.add(red).subtract(nir.add(blue)).divide(swir.add(red).add(nir.add(blue)))
            bsi_val = bsi.reduceRegion(ee.Reducer.mean(), geom, 1000).get("B11").getInfo() or 0
            context["bsi"] = round(bsi_val, 3)

        elif layer_type in ("temp_anomaly", "tci"):
            context["heat_label"] = (
                "Extreme heat stress"
                if context["tci"] < 20
                else (
                    "High heat stress"
                    if context["tci"] < 35
                    else "Moderate heat" if context["tci"] < 50 else "Normal temperature range"
                )
            )

        # ndvi, rainfall, spi → SPI and VCI already captured above

        # -----------------------------------------------------------
        # 7. Centroid for time-series chart generation
        # -----------------------------------------------------------
        centroid = geom.centroid().coordinates().getInfo()
        context["centroid"] = [centroid[0], centroid[1]]

    except Exception as e:
        import traceback

        print(f"Error in get_multi_index_context:\n{traceback.format_exc()}")
        context["error"] = str(e)

    return context


def get_forecast_context(scope_level: str, scope_name: str) -> dict:
    """Fetch GFS rainfall/temperature forecast data + the ERA5-Land historical air-temperature
    baseline (t_mean) for a scope — the grounding data for the forecast AI insights prompt."""
    require_gee()

    if scope_level == "national":
        countries = ee.FeatureCollection("USDOS/LSIB_SIMPLE/2017")
        geom = countries.filter(ee.Filter.eq("country_na", "Somalia")).geometry()
    elif scope_level == "region":
        regions = ee.FeatureCollection("FAO/GAUL/2015/level1")
        geom = regions.filter(ee.Filter.eq("ADM1_NAME", scope_name)).geometry()
    else:  # district
        districts = ee.FeatureCollection("FAO/GAUL/2015/level2")
        geom = districts.filter(ee.Filter.eq("ADM2_NAME", scope_name)).geometry()

    try:
        centroid = geom.centroid().coordinates().getInfo()
        lon, lat = centroid[0], centroid[1]

        # Fetch timeseries
        precip_ts = get_gfs_forecast_timeseries(lat, lon, "precip")
        temp_ts = get_gfs_forecast_timeseries(lat, lon, "temp")

        # Calculate sums/averages for 1, 3, 7, 14 days
        def get_sums(ts, days, key="value"):
            if not ts:
                return 0
            return round(sum([x.get(key, 0) for x in ts[:days]]), 2)

        def get_averages(ts, days, key="avg"):
            if not ts:
                return 0
            subset = [x.get(key, 0) for x in ts[:days] if x.get(key) is not None]
            if not subset:
                return 0
            return round(sum(subset) / len(subset), 2)

        r1 = get_sums(precip_ts, 1)
        r3 = get_sums(precip_ts, 3)
        r7 = get_sums(precip_ts, 7)
        r14 = get_sums(precip_ts, 14)

        t1 = get_averages(temp_ts, 1)
        t3 = get_averages(temp_ts, 3)
        t7 = get_averages(temp_ts, 7)
        t14 = get_averages(temp_ts, 14)

        # Build context
        context = {
            "region": scope_name,
            "scope_level": scope_level,
            "centroid": [lon, lat],
            "r1": r1,
            "r3": r3,
            "r7": r7,
            "r14": r14,
            "t1": t1,
            "t3": t3,
            "t7": t7,
            "t14": t14,
            "precip_ts": precip_ts,
            "temp_ts": temp_ts,
        }

        # Pull past observation (SPI) to fulfill SWALIM style context
        chirps = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
        date_str = datetime.now().strftime("%Y-%m-01")
        spi_val = (
            get_monthly_anomaly(chirps, "precipitation", date_str)
            .reduceRegion(ee.Reducer.mean(), geom, 5000)
            .get("anomaly")
            .getInfo()
        )
        context["past_spi"] = round(spi_val, 2) if spi_val is not None else 0

        # Calculate historical t_mean for this month using ERA5 Land 2m air temperature.
        # CRITICAL: GFS forecasts use 2m AIR temperature. We must compare against the same
        # variable. MODIS LST (Land Surface Temperature) is a completely different physical
        # quantity (bare soil/rock surface) and can be 15-20°C higher than air temperature —
        # it must NOT be used as a baseline for GFS air temperature comparisons.
        month = datetime.now().month
        era5 = ee.ImageCollection("ECMWF/ERA5_LAND/DAILY_AGGR")
        historical_air_temp = (
            era5.filter(ee.Filter.calendarRange(month, month, "month"))
            .filterDate("2001-01-01", "2021-01-01")  # 20-year climatological baseline
            .select("temperature_2m")
            .mean()
        )
        # ERA5 temperature_2m is stored in Kelvin (no scale factor — just subtract 273.15)
        t_mean_k = (
            historical_air_temp.reduceRegion(reducer=ee.Reducer.mean(), geometry=geom, scale=11132)
            .get("temperature_2m")
            .getInfo()
        )
        context["t_mean"] = round(t_mean_k - 273.15, 2) if t_mean_k is not None else 30.0

        return context

    except Exception as e:
        print(f"Error fetching forecast context: {e}")
        return {"error": str(e)}


def _get_bbox(geom):
    """Computes bounding box [min_x, min_y, max_x, max_y] of a GeoJSON geometry."""

    def extract_coords(coords):
        if not coords:
            return []
        if isinstance(coords[0], (int, float)):
            return [coords]
        res = []
        for c in coords:
            res.extend(extract_coords(c))
        return res

    flat_coords = extract_coords(geom.get("coordinates", []))
    if not flat_coords:
        return None
    xs = [c[0] for c in flat_coords]
    ys = [c[1] for c in flat_coords]
    return [min(xs), min(ys), max(xs), max(ys)]


def get_basin_rainfall(forecast_days: int, geojson_path: str):
    """
    Given a GeoJSON of basins, fetches the GFS forecasted rainfall for each basin for the next N days.
    Returns a dictionary mapping basin index (as string) to rainfall in mm.
    """
    require_gee()

    with open(geojson_path, "r", encoding="utf-8") as f:
        geojson_data = json.load(f)

    features = []
    for i, f in enumerate(geojson_data.get("features", [])):
        geom = f.get("geometry")
        if not geom:
            continue
        bbox = _get_bbox(geom)
        if not bbox:
            continue

        # Use a simple bounding box polygon for GEE to avoid payload size limits
        ee_geom = ee.Geometry.Rectangle(bbox)
        features.append(ee.Feature(ee_geom, {"basin_id": str(i)}))

    from datetime import datetime

    now = ee.Date(datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%S"))

    # Get latest GFS run
    latest_run = ee.Image(
        ee.ImageCollection("NOAA/GFS0P25")
        .filterDate(now.advance(-3, "day"), now)
        .sort("system:time_start", False)
        .first()
    )
    init_time = latest_run.get("system:time_start")

    # Get forecast for the next N days
    forecast_collection = (
        ee.ImageCollection("NOAA/GFS0P25")
        .filter(ee.Filter.eq("system:time_start", init_time))
        .filter(ee.Filter.lte("forecast_hours", forecast_days * 24))
    )

    # GFS precipitation is 'precipitation_rate' in kg/m^2/s (mm/s).
    # To get total cumulative rainfall in mm:
    # 1. Take the mean rate across the forecast period
    # 2. Multiply by the total number of seconds in that period
    mean_rate = forecast_collection.select("precipitation_rate").mean()
    total_seconds = forecast_days * 24 * 3600
    image = mean_rate.multiply(total_seconds)

    basin_rainfall = {}
    batch_size = 1000

    for i in range(0, len(features), batch_size):
        batch = features[i : i + batch_size]
        fc = ee.FeatureCollection(batch)

        stats = image.reduceRegions(collection=fc, reducer=ee.Reducer.mean(), scale=5000)

        result_features = stats.getInfo().get("features", [])

        for f in result_features:
            props = f.get("properties", {})
            b_id = props.get("basin_id")
            rain = props.get("mean", 0)
            if rain is None:
                rain = 0
            if b_id is not None:
                basin_rainfall[b_id] = rain

    return basin_rainfall
