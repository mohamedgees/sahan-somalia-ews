# Sahan — Methodology & Architecture Reference

## Project Identity
- **Name:** Sahan — Somalia National Drought Early Warning System
- **Owner:** TerraTech Solutions
- **Purpose:** Real-time satellite-driven drought, rainfall, vegetation, soil moisture, and flash flood monitoring for Somalia decision-makers.

---

## Tech Stack
| Layer | Technology |
|---|---|
| Backend | Python 3.13 + FastAPI + Uvicorn (port 8000) |
| GEE | `earthengine-api` + Service Account (`gee-key.json`) |
| AI Engine | DeepSeek (`deepseek-v4-flash`) via OpenAI-compatible API (`DEEPSEEK_API_KEY` in `.env`) |
| Frontend | React 18 + Vite + Leaflet (react-leaflet) + Recharts (port 5173) |

---

## Architecture Overview

- **Monitor Tab** = interactive map + layer tile overlay + bottom chart panel on click.
- **Forecast Tab** = GFS map tile overlay + AI forecast narrative.
- **Flash Flood** = basin GeoJSON risk overlay on the map.
- AI insights (situation, drivers, risk level, recommendations, charts) are generated per map click / scope selection via the `/api/insights/analyze` endpoint.

---

## Climate Index Standards

### Normalization (ICPAC-inspired — 0.0 to 1.0 stress scale)
All drought stress scores are normalized on a 0.0 (no stress) to 1.0 (extreme stress) scale:

```
SPI Stress  = abs(clamp(SPI, -3.0, 0.0)) / 3.0
VHI Stress  = 1.0 - (VHI / 100.0)
SMI Stress  = abs(clamp(SMI_anomaly, -3.0, 0.0)) / 3.0
SPEI Stress = abs(clamp(SPEI, -3.0, 0.0)) / 3.0
```

### Seasonal Weighting Matrix (CDI composite)
CDI here is a **simplified linear composite** (this project's own calibration, not yet
externally validated against an ICPAC reference dataset), not the published ICPAC/JRC-EDO
categorical Watch→Warning→Alert decision tree (Sepulcre-Cantó et al., 2012).

| Season | SPI | VHI | SMI | SPEI |
|---|---|---|---|---|
| Rainy (Gu / Deyr) | 30% | 25% | 20% | 25% |
| Dry (Jilaal / Xagaa) | 50% | 35% | 15% | 0% |

### Drought Severity Classification (0–1 CDI scale, ICPAC-inspired)
Project-defined thresholds; not a verified external WMO/ICPAC citation.

| CDI Score | Category |
|---|---|
| 0.00 – 0.20 | Normal |
| 0.20 – 0.40 | Watch |
| 0.40 – 0.60 | Moderate |
| 0.60 – 0.80 | Severe |
| 0.80 – 1.00 | Extreme |

### SPEI — real water balance, not a rainfall-only proxy
SPEI is computed as the standardized anomaly of `Precipitation - Potential Evapotranspiration`,
using ERA5-Land's own physically-based `potential_evaporation_sum` for PET (not a hand-rolled
approximation). See `app/services/gee_utils.py`'s `get_water_balance_anomaly`.

---

## Somalia Seasonal Calendar
| Season | Months | Type |
|---|---|---|
| Jilaal | Jan–Mar | Dry |
| Gu | Apr–Jun | Rainy (Main) |
| Xagaa | Jul–Sep | Dry |
| Deyr | Oct–Dec | Rainy (Short) |

---

## Data Integrity Rules
- Rainfall/temperature anomalies are standardized against a **yearly climatology population**
  (one aggregate per year for the target calendar month), not a pool of raw sub-monthly
  observations — see `_yearly_climatology_stats` in `gee_utils.py`.
- SPI anomalies use **30-year CHIRPS climatology (1991–2020)**.
- MODIS NDVI and LST use the **full archive (2000–present)** as the historical min/max baseline.
- ERA5-Land is used exclusively for **2m AIR temperature baseline** (Kelvin → subtract 273.15) —
  never MODIS LST, which is surface (not air) temperature and can differ by 15-20°C.
- GFS `temperature_2m_above_ground` is **native Celsius** — no unit conversion required. (Verified
  2026-07-25 via a live query at Mogadishu: raw value ≈26°C, a plausible air temperature — would
  be nonsensical if this were Kelvin.)
- MODIS LST `LST_Day_1km` requires: `°C = raw × 0.02 − 273.15`.

---

## AI Insight Rules
- **NEVER** mention technical index names (SPI, NDVI, VCI, TCI, CDI, SPEI) in user-facing text.
- **ALWAYS** compare current conditions to long-term climatology as primary reference.
- **ALWAYS** cite previous rainy season performance (Gu/Deyr) as primary vulnerability driver.
- Use FAO SWALIM reporting style for forecast insights.
- DeepSeek model: `deepseek-v4-flash`, temperature: `0.2`.
- Cache insights for 6 hours per scope+layer key; rate-limited per client IP (10 req/min).

---

## Key File Locations
| Purpose | Path |
|---|---|
| FastAPI app entrypoint | `backend/app/main.py` |
| API routers | `backend/app/routers/` (health, layers, stats, insights, admin, alerts) |
| GEE functions | `backend/app/services/gee_utils.py` |
| ICPAC normalization / CDI engine | `backend/app/services/risk_engine.py` |
| Flash flood processor | `backend/app/services/flood_processor.py` |
| Shared cache / rate limiter / path anchors | `backend/app/core/` |
| Main dashboard component | `frontend/src/components/MapDashboard.jsx` |
| Legend component | `frontend/src/components/Legend.jsx` |
| Basin susceptibility data | `flash floods base data/somalia_basins_ffsi.geojson` |
| Water sources survey | `backend/water_sources.csv` |
| API config | `frontend/src/config.js` |
