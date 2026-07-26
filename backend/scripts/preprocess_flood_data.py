import os
import sys

import geopandas as gpd
import numpy as np
import rasterio
from rasterstats import zonal_stats

# This script lives in backend/scripts/; add backend/ to sys.path so the
# app.core.paths anchor (single source of truth for project-relative paths)
# can be imported regardless of where this script is invoked from.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.paths import FLASH_FLOOD_DATA_DIR  # noqa: E402


def calculate_slope(dem_array, cell_size):
    """Calculates slope in degrees from a DEM array using numpy gradients."""
    y, x = np.gradient(dem_array, cell_size, cell_size)
    slope = np.arctan(np.sqrt(x * x + y * y)) * (180.0 / np.pi)
    return slope


def main():
    data_dir = FLASH_FLOOD_DATA_DIR

    dem_path = os.path.join(data_dir, "somalia_srtm_30m-0000000000-0000000000.tif")
    lc_path = os.path.join(data_dir, "somalia_landcover_10m-0000000000-0000065536.tif")
    soil_path = os.path.join(data_dir, "Somalia_Soil_Infiltration_Cap.tif")
    water_mask_path = os.path.join(data_dir, "Somalia_Static_Water_Mask.tif")
    basins_path = os.path.join(data_dir, "somalia_basins.geojson")

    out_geojson = os.path.join(data_dir, "somalia_basins_ffsi.geojson")

    print("Loading basins...")
    basins = gpd.read_file(basins_path)

    # Process DEM for Slope
    print("Processing DEM for Slope...")
    if os.path.exists(dem_path):
        with rasterio.open(dem_path) as src:
            dem_data = src.read(1)
            transform = src.transform
            cell_size = transform[0]  # assuming square pixels

            print("Calculating slope...")
            slope_data = calculate_slope(dem_data, cell_size)

            print("Calculating zonal stats for Slope...")
            slope_stats = zonal_stats(
                basins, slope_data, affine=transform, stats="mean", nodata=np.nan
            )
            basins["mean_slope"] = [s["mean"] if s["mean"] is not None else 0 for s in slope_stats]

        del dem_data
        del slope_data
    else:
        print("DEM data not found, skipping...")
        basins["mean_slope"] = 0.5

    # Process Land Cover
    print("Processing Land Cover...")
    if os.path.exists(lc_path):
        with rasterio.open(lc_path) as src:
            lc_data = src.read(1)
            transform = src.transform
            lc_runoff = np.zeros_like(lc_data, dtype=np.float32)
            lc_runoff[lc_data == 50] = 0.9
            lc_runoff[lc_data == 60] = 0.8
            lc_runoff[lc_data == 40] = 0.6
            lc_runoff[lc_data == 30] = 0.4
            lc_runoff[lc_data == 20] = 0.3
            lc_runoff[lc_data == 10] = 0.1
            lc_runoff[lc_data == 80] = 1.0

            print("Calculating zonal stats for Land Cover...")
            lc_stats = zonal_stats(basins, lc_runoff, affine=transform, stats="mean", nodata=0.0)
            basins["mean_lc"] = [s["mean"] if s["mean"] is not None else 0 for s in lc_stats]

        del lc_data
        del lc_runoff
    else:
        print("Land Cover data not found, skipping...")
        basins["mean_lc"] = 0.5

    # Process Soil Infiltration
    print("Processing Soil Infiltration...")
    if os.path.exists(soil_path):
        with rasterio.open(soil_path) as src:
            soil_data = src.read(1)
            transform = src.transform
            print("Calculating zonal stats for Soil...")
            soil_stats = zonal_stats(
                basins, soil_data, affine=transform, stats="mean", nodata=src.nodata
            )
            basins["mean_soil"] = [s["mean"] if s["mean"] is not None else 0 for s in soil_stats]
    else:
        print("Soil data not found, skipping...")
        basins["mean_soil"] = 0.5

    # Process Water Mask (Proxy for TWI)
    print("Processing Water Mask / TWI Proxy...")
    if os.path.exists(water_mask_path):
        with rasterio.open(water_mask_path) as src:
            water_data = src.read(1)
            transform = src.transform
            print("Calculating zonal stats for Water Mask...")
            water_stats = zonal_stats(
                basins, water_data, affine=transform, stats="mean", nodata=src.nodata
            )
            basins["mean_twi"] = [s["mean"] if s["mean"] is not None else 0 for s in water_stats]
    else:
        print("Water Mask data not found, skipping...")
        basins["mean_twi"] = 0.5

    def normalize_col(col):
        min_val = col.min()
        max_val = col.max()
        if max_val > min_val:
            return (col - min_val) / (max_val - min_val)
        return col * 0

    print("Normalizing and calculating FFSI...")

    slope_norm = normalize_col(basins["mean_slope"])
    soil_norm = 1.0 - normalize_col(basins["mean_soil"])
    lc_norm = normalize_col(basins["mean_lc"])
    twi_norm = normalize_col(basins["mean_twi"])

    basins["ffsi"] = (0.4 * slope_norm) + (0.3 * soil_norm) + (0.2 * lc_norm) + (0.1 * twi_norm)

    print("Saving processed basins to GeoJSON...")
    basins = basins.drop(columns=["mean_slope", "mean_soil", "mean_lc", "mean_twi"])
    basins.to_file(out_geojson, driver="GeoJSON")
    print(f"Successfully generated {out_geojson}")


if __name__ == "__main__":
    main()
