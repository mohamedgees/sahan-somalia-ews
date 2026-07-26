import json
import os

from app.core.paths import FLASH_FLOOD_DATA_DIR


class FloodProcessor:
    def __init__(self):
        self.geojson_path = os.path.join(FLASH_FLOOD_DATA_DIR, "somalia_basins_ffsi.geojson")
        self.basins_data = None
        self._load_basins()

    def _load_basins(self):
        if not os.path.exists(self.geojson_path):
            print(
                f"Warning: {self.geojson_path} not found. Please run preprocess_flood_data.py first."
            )
            return

        with open(self.geojson_path, "r", encoding="utf-8") as f:
            self.basins_data = json.load(f)

    def get_flood_alerts(self, threshold=0.5):
        """
        Fetches dynamic rainfall and computes risk per basin.
        """
        if not self.basins_data:
            return {"error": "Basin susceptibility data not loaded."}

        # We need the gee_utils module to fetch rainfall per basin
        from app.services.gee_utils import get_basin_rainfall

        # We can pass the geojson path or the loaded dict to gee_utils
        # Let's pass the features so we don't have to reload

        # Fetch 3-day forecast rainfall per basin
        # Returning a dict mapping basin index or ID to rainfall value
        try:
            basin_rainfall_map = get_basin_rainfall(3, self.geojson_path)
        except Exception as e:
            return {"error": f"Failed to fetch rainfall: {str(e)}"}

        alerts = []
        updated_features = []

        for i, feature in enumerate(self.basins_data.get("features", [])):
            props = feature.get("properties", {})
            basin_id = str(i)  # Assuming index is ID if no explicit ID
            # In gee_utils, we'll map the features with their index as an ID if they lack one

            susceptibility = props.get("ffsi", 0)
            rainfall = basin_rainfall_map.get(basin_id, 0)

            # Define risk score: simple product of rainfall and susceptibility
            # susceptibility is 0-1. rainfall is typically 0-150mm.
            risk_score = susceptibility * rainfall

            status = "Low"
            color = "#2ecc71"

            # Dynamic thresholding based on the score
            # Example: 100mm rain * 0.5 ffsi = 50.
            if risk_score > threshold * 2:
                status = "High"
                color = "#e74c3c"
                alerts.append(
                    {
                        "basin_index": i,
                        "rainfall": round(rainfall, 2),
                        "susceptibility": round(susceptibility, 3),
                        "risk_score": round(risk_score, 2),
                        "status": status,
                    }
                )
            elif risk_score > threshold:
                status = "Moderate"
                color = "#f39c12"

            # Update feature properties for the map rendering
            feature["properties"]["current_rainfall"] = round(rainfall, 2)
            feature["properties"]["risk_score"] = round(risk_score, 2)
            feature["properties"]["status"] = status
            feature["properties"]["color"] = color

            updated_features.append(feature)

        # Return both the alerts list and the GeoJSON so the frontend can render it
        return {
            "alerts": alerts,
            "layer_data": {"type": "FeatureCollection", "features": updated_features},
        }


# Module-level singleton — basin data is loaded once and shared by both the
# alerts and layers routers (avoids reloading the geojson per request).
flood_processor = FloodProcessor()
