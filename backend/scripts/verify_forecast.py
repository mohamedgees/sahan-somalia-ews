"""Ad-hoc sanity check: confirms GEE is reachable and the GFS forecast
timeseries fetch (precip + temp) returns data for a known point (Mogadishu).
Run from the backend/ directory: python scripts/verify_forecast.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.gee_utils import get_gfs_forecast_timeseries, init_gee

try:
    init_gee()
    print("GEE Initialized")
except Exception as e:
    print(f"GEE Init Failed: {e}")
    sys.exit(1)


def verify():
    # Mogadishu coordinates
    lat = 2.0469
    lon = 45.3182

    print("\nRequesting Precip Forecast...")
    precip = get_gfs_forecast_timeseries(lat, lon, "precip")
    print(f"Precip Data Points: {len(precip)}")
    for p in precip[:3]:
        print(p)

    print("\nRequesting Temp Forecast...")
    temp = get_gfs_forecast_timeseries(lat, lon, "temp")
    print(f"Temp Data Points: {len(temp)}")
    for t in temp[:3]:
        print(t)


if __name__ == "__main__":
    verify()
