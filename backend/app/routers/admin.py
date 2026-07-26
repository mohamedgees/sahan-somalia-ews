"""Administrative/reference data endpoints (water source survey points)."""

import csv
import os

from fastapi import APIRouter

from app.core.errors import api_error_response
from app.core.paths import WATER_SOURCES_CSV

router = APIRouter()


@router.get("/api/water-sources")
def get_water_sources():

    csv_path = WATER_SOURCES_CSV

    if not os.path.exists(csv_path):

        return {"error": "CSV file not found", "path": csv_path}

    features = []

    try:

        with open(csv_path, mode="r", encoding="utf-8-sig") as f:

            reader = csv.DictReader(f)

            for row in reader:

                try:

                    lat_str = row.get("sectionA/_source_gpspoint_latitude")

                    lon_str = row.get("sectionA/_source_gpspoint_longitude")

                    if not lat_str or not lon_str:

                        continue

                    lat = float(lat_str)

                    lon = float(lon_str)

                    # Basic validation for Somalia coordinates

                    if not (2.0 < lon < 55.0 and -2.0 < lat < 14.0):

                        continue

                    # Extract and clean status

                    raw_status = str(row.get("sectionB/functioning", "no")).lower().strip()

                    status = "no"

                    if "yes" in raw_status:

                        status = "yes"

                    elif "abandoned" in raw_status:

                        status = "abandoned"

                    def try_float(val):

                        try:

                            return float(val) if val and val.strip() else 0.0

                        except ValueError:

                            return 0.0

                    # Create property mapping for cleaner display and graphing

                    properties = {
                        "name": row.get("sectionA/source_name", "Unknown"),
                        "type": row.get("sectionA/source_type", "Unknown"),
                        "region": row.get("sectionA/district_regions", "Unknown"),
                        "district": row.get("sectionA/district", "Unknown"),
                        "settlement": row.get("sectionA/settlement_name", "Unknown"),
                        "functioning": status,
                        "capacity": try_float(row.get("sectionD/reservoir_capacity")),
                        "yield": try_float(row.get("sectionC/bh_yield")),
                        "depth": try_float(row.get("sectionC/bh_depth")),
                        "static_level": try_float(row.get("sectionC/bh_static_level")),
                        "temperature": try_float(row.get("sectionE/temperature")),
                        "pH": try_float(row.get("sectionE/pH")),
                        "ec": try_float(row.get("sectionE/ec25")),
                        "tds": try_float(row.get("sectionE/tds")),
                        "cost": try_float(row.get("sectionF/water_cost_human")),
                        "agency": row.get("sectionA/inspecting_agency", "Unknown"),
                    }

                    features.append(
                        {
                            "id": f"ws-{len(features)}",  # Unique ID
                            "type": "Feature",
                            "geometry": {"type": "Point", "coordinates": [lon, lat]},
                            "properties": properties,
                        }
                    )

                except (ValueError, TypeError):

                    continue

        return {"type": "FeatureCollection", "features": features}

    except Exception as e:

        return api_error_response(e)
