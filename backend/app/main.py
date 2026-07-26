"""FastAPI application entrypoint for the Somalia Drought EWS ("Sahan") backend.

Run with: uvicorn app.main:app --reload --port 8000 (from the backend/ directory).
"""

import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import admin, alerts, health, insights, layers, stats
from app.services.gee_utils import init_gee

load_dotenv()

logging.basicConfig(level=logging.INFO)

logger = logging.getLogger("somalia_ews")

app = FastAPI(title="Somalia Drought EWS API")

# Allow CORS for the frontend. Local dev origins are always allowed; a
# deployed frontend's origin(s) are added via FRONTEND_ORIGINS (comma-
# separated, e.g. "https://sahan.vercel.app") so production hosts don't
# require a code change to be reachable.
origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
]
extra_origins = os.environ.get("FRONTEND_ORIGINS", "")
origins += [o.strip() for o in extra_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(layers.router)
app.include_router(stats.router)
app.include_router(insights.router)
app.include_router(admin.router)
app.include_router(alerts.router)


@app.on_event("startup")
async def startup_event():
    # Attempt to initialize GEE on startup, but don't crash if it fails
    # immediately (handling it in the health check is safer for debugging).
    try:
        init_gee()
    except Exception as e:
        print(f"Startup GEE Auth Warning: {e}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
