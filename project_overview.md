# Somalia Drought Early Warning System (EWS)
### Complete Project Reference — *Powered by TerraTech Solutions*

---

## 1. System Overview

The **Somalia Drought EWS** (codenamed *Sahan*) is a real-time environmental intelligence platform for monitoring drought conditions, rainfall patterns, vegetation health, soil moisture, surface temperature, and flash flood risk across Somalia. It combines **Google Earth Engine satellite data**, a **FastAPI Python backend**, a **React/Leaflet frontend**, and **DeepSeek AI** for automated narrative insights.

```
┌──────────────────────────────────────────────────────────────┐
│                   BROWSER (React + Leaflet)                  │
│  Map View  │  Sidebar Controls  │  Bottom Panel (Charts/AI)  │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTP / Axios
┌────────────────────────▼─────────────────────────────────────┐
│              FASTAPI BACKEND  (Python, port 8000)            │
│  main.py  ─►  gee_utils.py  ─►  Google Earth Engine API     │
│              flood_processor.py (Flash Flood FFSI)           │
│              DeepSeek LLM  (AI Insights)                     │
└──────────────────────────────────────────────────────────────┘
```

**Stack:**

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Leaflet (react-leaflet), Recharts |
| Backend | Python 3.13, FastAPI, Uvicorn |
| Satellite Data | Google Earth Engine (GEE) Python API |
| AI Engine | DeepSeek Chat (via OpenAI-compatible API) |
| Auth | GEE Service Account (`gee-key.json`) |
| Deployment | Local dev: `npm run dev` (port 5173) + `uvicorn` (port 8000) |

---

## 2. Data Layers & Source Datasets

### 2.1 Monitor Tab Layers

| Layer | Dataset / Source | GEE Collection | Temporal Resolution | Description |
|---|---|---|---|---|
| **NDVI (Vegetation Health)** | MODIS Terra MOD13Q1 | `MODIS/061/MOD13Q1` | 16-day composite | Normalised Difference Vegetation Index (0–1). Reflects live green vegetation cover. |
| **Rainfall (CHIRPS)** | CHIRPS Daily | `UCSB-CHG/CHIRPS/DAILY` | Daily | Cumulative precipitation in mm over selected period. |
| **Soil Moisture Index (SMI)** | NASA FLDAS NOAH | `NASA/FLDAS/NOAH01/C/GL/M/V001` | Monthly | Soil moisture anomaly (0–10 cm depth), standardised vs. 1982–present climatology. |
| **SPEI** | CHIRPS + ERA5-Land | `UCSB-CHG/CHIRPS/DAILY` + `ECMWF/ERA5_LAND/DAILY_AGGR` | Monthly | Standardised Precipitation−Evapotranspiration Index: real water balance (P − PET), using ERA5-Land's own physically-based `potential_evaporation_sum` for PET, standardised against a 1991–2020 yearly climatology. |
| **Land Surface Temperature** | MODIS MOD11A1 | `MODIS/061/MOD11A1` | Daily | MODIS LST Day (1 km), converted: `°C = raw × 0.02 − 273.15`. |

### 2.2 Forecast Tab Layers

| Layer | Dataset / Source | GEE Collection | Description |
|---|---|---|---|
| **Rainfall Prediction** | NOAA GFS 0.25° | `NOAA/GFS0P25` | Cumulative forecasted rainfall (mm) for 1 / 3 / 7 / 14 days. Rendered using SWALIM colour classification. |
| **Temperature Prediction** | NOAA GFS 0.25° | `NOAA/GFS0P25` | Forecasted 2 m air temperature (°C) — **native Celsius in GEE**, no conversion needed. Min / Avg / Max daily bands. |

### 2.3 Analysis Tab Layers

| Layer | Formula / Source | Description |
|---|---|---|
| **CDI (Combined Drought Index)** | CHIRPS + MODIS NDVI/LST + FLDAS + ERA5-Land | Seasonally-weighted composite of 4 normalized stress scores: SPI + VHI + SMI + SPEI (see §9 for exact weights). Scale 0–1 where 1 = extreme drought. **Note:** this is a simplified linear composite inspired by ICPAC's Combined Drought Indicator, not the published categorical ICPAC/JRC-EDO Watch→Warning→Alert methodology — weights are this project's own calibration, pending ICPAC validation. |
| **VHI (Vegetation Health Index)** | MODIS NDVI + MODIS LST | `0.5×VCI + 0.5×TCI`. Scale 0–100. Below 40 = stressed. |
| **TCI (Temperature Condition Index)** | MODIS LST MOD11A1 | `100 × (LST_max − LST) / (LST_max − LST_min)`. High value = cool relative to history. |
| **Temperature Anomaly** | MODIS LST MOD11A1 | Standardised Z-score of LST vs. 2000–present monthly climatology. |
| **BSI (Bare Soil Index)** | Sentinel-2 SR | `(SWIR + Red − NIR − Blue) / (SWIR + Red + NIR + Blue)`. Vegetation masked (NDVI < 0.35). |
| **SPI (Standardised Precip Index)** | CHIRPS | Monthly standardised anomaly vs. 1991–2020 climatology. Negative = dry, positive = wet. |

### 2.4 Flash Flood Early Warning Layer

| Component | Description |
|---|---|
| **FFSI (Flash Flood Susceptibility Index)** | Static raster preprocessed from DEM + landcover + soil type. Stored as `somalia_basins_ffsi.geojson`. |
| **Dynamic Rainfall** | GFS 3-day forecast rainfall per basin (`get_basin_rainfall`). |
| **Risk Score** | `FFSI × rainfall`. Thresholds: Low / Moderate / High. |
| **Endpoint** | `GET /api/alerts/flash-flood?threshold=50` |

### 2.5 Contextual Overlay Layers

| Layer | Source | Description |
|---|---|---|
| **Region Boundaries** | FAO GAUL Level 1 (via backend `/boundary?region=`) | Administrative boundary outlines for all 18 regions. |
| **District Boundaries** | FAO GAUL Level 2 (via backend `/boundary?region=&district=`) | District-level polygons, loaded on demand. |
| **Water Sources** | `water_sources.csv` (SWALIM field survey) | Boreholes, dugwells, springs with capacity, pH, yield, functioning status. |

---

## 3. Colour Palettes & Visualisation

### SWALIM Rainfall Classification (CHIRPS & GFS Precip)

| Class | Range (mm) | Colour |
|---|---|---|
| 0 | 0–2 | White `#FFFFFF` |
| 1 | 2–5 | Cream `#FFFBCC` |
| 2 | 5–10 | Light green `#BCE895` |
| 3 | 10–20 | Dark green `#2E6219` |
| 4 | 20–30 | Light blue `#53BBD4` |
| 5 | 30–40 | Blue `#29AEE2` |
| 6 | 40–50 | Medium blue `#5C97ED` |
| 7 | 50–100 | Deep blue `#1D3F96` |
| 8 | 100–150 | Purple `#441269` |
| 9 | 150–200 | Orange `#D64A13` |
| 10 | 200–250 | Dark red `#7A2617` |

### CDI / Drought Severity Palette

| Status | CDI Value | Colour |
|---|---|---|
| Normal | 0–0.2 | Green `#05e100` |
| Watch | 0.2–0.4 | Yellow `#ffff00` |
| Moderate | 0.4–0.6 | Orange `#ff9900` |
| Severe | 0.6–0.8 | Red `#ff0000` |
| Extreme | > 0.8 | Dark red `#990000` |

### Temperature & Anomaly Palettes

| Layer | Min | Max | Palette |
|---|---|---|---|
| LST Temperature (°C) | 20 | 50 | Blue → Cyan → Yellow → Red |
| GFS Forecast Temp (°C) | 20 | 45 | Blue → Cyan → Yellow → Red |
| Temp Anomaly / SMI / SPI (Z-score) | −2 | +2 | Blue → White → Red (diverging) |

---

## 4. Frontend UI Structure

### Sidebar (Left Panel)

```
┌─────────────────────────┐
│  Logo + Subtitle        │
│  Digital Clock          │
│─────────────────────────│
│  [Monitor] [Forecast]   │
│  [Analysis]  ← Tabs     │
│─────────────────────────│
│  Filter by Area         │
│    Region dropdown      │
│    District checkboxes  │
│─────────────────────────│
│  Filter by Date (Month) │
│    Year select          │
│    Month select         │
│    Timeline slider      │
│─────────────────────────│
│  Find Location          │
│    Lat/Lon input        │
│    GPS button           │
│─────────────────────────│
│  Layer Controls         │
│    (context-sensitive)  │
│─────────────────────────│
│  Legend                 │
│─────────────────────────│
│  Generate PDF Report    │
└─────────────────────────┘
```

### Monitor Tab Layers Panel
- NDVI (Vegetation Health) — MODIS
- Rainfall — CHIRPS
- Soil Moisture Index — FLDAS
- SPEI — FLDAS
- LST Temperature — MODIS

### Forecast Tab Controls
- Rainfall Prediction: 1 / 3 / 7 / 14 day buttons (GFS)
- Temperature Prediction: 1 / 3 / 7 / 14 day buttons (GFS)

### Analysis Tab
- Combined Drought Index (CDI)

### Map Area (Right Panel)
- **Base maps:** Satellite (ESRI), OSM, Light Streets (Carto), Dark Theme (Carto)
- **Overlays:** Active layer tile, Water Sources, Region boundaries, District boundaries
- **Click-to-Analyse:** Clicking any point on the map triggers `fetchStats()` → calls `/api/stats/point_v2` → shows bottom panel

### Bottom Panel (on click)
Split into two columns:
1. **Left — Chart**: Recharts `LineChart` or `BarChart` with min/avg/max temperature lines or single-value bars. Type automatically selected by `stats.type`.
2. **Right — Tabular Data**: Scrollable table of date vs. values. Columns adapt to type (Min/Avg/Max for temperature, Date/Value for others).
- Download CSV / JSON buttons
- Close button

---

## 5. Backend API Endpoints

### Layer Tile Endpoints (Map Rendering)

| Method | Endpoint | Parameters | Returns |
|---|---|---|---|
| GET | `/api/layers/ndvi` | `start`, `end` | GEE tile URL |
| GET | `/api/layers/rainfall` | `start`, `end` | GEE tile URL (SWALIM classified) |
| GET | `/api/layers/temperature` | `start`, `end` | GEE tile URL (°C) |
| GET | `/api/layers/smi` | `date` | GEE tile URL (anomaly) |
| GET | `/api/layers/spei` | `date` | GEE tile URL (anomaly) |
| GET | `/api/layers/spi` | `date` | GEE tile URL (anomaly) |
| GET | `/api/layers/vhi` | `date` | GEE tile URL |
| GET | `/api/layers/tci` | `date` | GEE tile URL |
| GET | `/api/layers/temp_anomaly` | `date` | GEE tile URL |
| GET | `/api/layers/bsi` | `date` | GEE tile URL |
| GET | `/api/layers/cdi` | `date` | GEE tile URL |
| GET | `/api/layers/forecast` | `type=precip\|temp`, `days` | GEE tile URL |
| GET | `/api/layers/flash-flood-basins` | `threshold` | GeoJSON FeatureCollection |

### Point Statistics Endpoints (Map Click)

| Method | Endpoint | Key Parameters | Returns |
|---|---|---|---|
| GET | `/api/stats/point_v2` | `lat`, `lon`, `type`, `end` | `{data: [...], label, type}` |

**`type` options:** `ndvi`, `rainfall`, `smi`, `spei`, `spi`, `vhi`, `temp_anomaly`, `tci`, `bsi`, `temperature`, `forecast_precip_*`, `forecast_temp_*`, `cdi`

### Admin & Utility Endpoints

| Method | Endpoint | Returns |
|---|---|---|
| GET | `/api/health-check` | GEE connection status |
| GET | `/api/regions` | List of 18 Somalia regions |
| GET | `/api/districts?region=X` | Districts within a region |
| GET | `/api/boundary?region=X&district=Y` | GeoJSON polygon |
| GET | `/api/drought/stats?date=` | National CDI + district hotspot table |
| GET | `/api/alerts?level=1\|2` | NDVI-based drought alerts by region/district |
| GET | `/api/water-sources` | GeoJSON of all water source points |
| GET | `/api/alerts/flash-flood?threshold=` | Flash flood basin risk status |

### AI Insights Endpoint

| Method | Endpoint | Body | Returns |
|---|---|---|---|
| POST | `/api/insights/analyze` | `{scope_level, scope_name, layer, month, year}` | AI narrative JSON |

---

## 6. Somalia Seasonal Calendar

The system is season-aware. All drought assessments reference the correct rainy season context.

| Season | Months | Type | Notes |
|---|---|---|---|
| **Jilaal** | Jan–Mar | Dry | Post-Deyr; most severe dry period |
| **Gu** | Apr–Jun | Rainy | Main/Long rains — primary agricultural season |
| **Xagaa** | Jul–Sep | Dry | Inter-seasonal dry period |
| **Deyr** | Oct–Dec | Rainy | Short rains — secondary agricultural season |

**CDI Weights by Season** (this project's own calibration — see `risk_engine.py`, not an external ICPAC citation):
- Rainy (Gu / Deyr): SPI 30% + VHI 25% + SMI 20% + SPEI 25%
- Dry (Jilaal / Xagaa): SPI 50% + VHI 35% + SMI 15% + SPEI 0%

---

## 7. AI Insights Pipeline (DeepSeek)

### 7.1 Historical Layers (Monitor / Analysis)

**Step 1 — Fetch GEE Context** (`get_multi_index_context`)

Collects the following for the selected scope (national / region / district):

| Variable | Source | Meaning |
|---|---|---|
| `spi` | CHIRPS vs. 1991–2020 | Current month rainfall anomaly |
| `vci` | MODIS NDVI min/max | Vegetation condition (0–100%) |
| `tci` | MODIS LST min/max | Temperature condition (0–100%) |
| `cdi` | Weighted composite | Combined drought stress (0–1) |
| `soil_moisture` | FLDAS anomaly | Soil water deficit/surplus |
| `spei` | FLDAS rain-ET anomaly | Water balance index |
| `vhi` | VCI + TCI average | Vegetation health score |
| `bsi` | Sentinel-2 | Bare soil exposure |
| `previous_season_*` | CHIRPS 3-month SPI | Gu or Deyr performance label |
| `prev2_season_*` | CHIRPS 3-month SPI | Season before that performance |
| `trend` | 3-month SPI slope | Improving / stable / worsening |
| `centroid` | Geometry centroid | Lon/lat for timeseries extraction |

**Step 2 — Build Structured Prompt**

Key rules injected into the prompt:
- Always compare to 30-year long-term climatology
- Previous rainy seasons (Gu/Deyr) are the primary vulnerability drivers
- No technical index names (SPI/NDVI/VCI/TCI/CDI) — translate to plain language
- Geography-specific: Region → list districts; District → mention settlements

**Step 3 — DeepSeek API Call**

```
Model: deepseek-chat
Temperature: 0.2 (low randomness for consistency)
Response format: JSON object (strict)
```

**Step 4 — Output JSON Schema (Historical)**

```json
{
  "situation": "Clear summary vs long-term norms",
  "drivers": ["driver 1", "driver 2"],
  "impact": ["real-world effect 1", "effect 2"],
  "risk_level": "Normal | Watch | Moderate | Severe",
  "recommendations": ["action 1", "action 2", "action 3"],
  "confidence_note": "Data quality / limitations note",
  "charts": [
    {
      "title": "Historical Precipitation Anomaly (12-Month SPI)",
      "type": "bar",
      "data": [...monthly SPI timeseries...]
    },
    {
      "title": "Vegetation Health & Stress Indicators (12-Month VHI)",
      "type": "line",
      "data": [...monthly VHI timeseries...]
    },
    {
      "title": "Surface Temperature Volatility (12-Month TCI)",
      "type": "line",
      "data": [...monthly temp anomaly timeseries...]
    }
  ]
}
```

The 3 charts are generated **in parallel** (ThreadPoolExecutor, 3 workers) for speed.

---

### 7.2 Forecast Layer (Forecast Tab)

**Step 1 — Fetch Forecast Context** (`get_forecast_context`)

| Variable | Source | Notes |
|---|---|---|
| `r1 / r3 / r7 / r14` | GFS `precipitation_rate` | Cumulative rainfall (mm) for 1/3/7/14 days |
| `t1 / t3 / t7 / t14` | GFS `temperature_2m_above_ground` | Average daily air temp (°C, native GEE unit) |
| `past_spi` | CHIRPS current month | Recent rainfall anomaly for context |
| `t_mean` | ERA5 Land `temperature_2m` (2001–2020) | **Kelvin → converted `−273.15`** = historical air temp baseline |
| `precip_ts` / `temp_ts` | GFS 16-day arrays | Full time-series for charts |

> **Critical unit note:** GFS temperatures are native °C. ERA5 temperatures are Kelvin and require `−273.15`. MODIS LST requires `×0.02 −273.15`.

**Step 2 — Build FAO SWALIM Style Prompt**

Rules:
- Always mention "NOAA-NCEP GFS model" in the summary
- Review past conditions before forecast
- Compare forecast temperature to ERA5 `t_mean` baseline (not raw value)
- Rainfall thresholds: 0–5mm Dry / 5–20mm Light / 20–50mm Moderate / >50mm Heavy
- Temperature anomaly: ±1°C = Normal / +1–2°C = Moderate stress / >+2°C = High stress

**Step 3 — Output JSON Schema (Forecast)**

```json
{
  "summary": "1-sentence past review + 1-sentence forecast impact",
  "key_insights": ["Bullet 1", "Bullet 2", "Bullet 3"],
  "risk_levels": {
    "drought": "Low | Moderate | High",
    "flood": "Low | Moderate | High",
    "heat_stress": "Normal | Moderate | High",
    "water_availability": "Stable | Stressed | Critical"
  },
  "trend_analysis": {
    "rainfall": "Increasing | Decreasing | Unstable",
    "temperature": "Increasing | Stable | Decreasing"
  },
  "early_warnings": ["Warning 1", "Warning 2"],
  "charts": [
    {"title": "Forecasted Precipitation (16 Days)", "type": "bar", ...},
    {"title": "Forecasted Temperature (16 Days)", "type": "line", ...}
  ]
}
```

### 7.3 Caching

Insights are cached in-memory (`AI_INSIGHT_CACHE`) for **6 hours** per `scope_level + scope_name + layer` key to reduce API calls and latency.

---

## 8. Administrative Scope

The system supports three geographic scopes for analysis:

| Scope | GEE Source | Example |
|---|---|---|
| **National** | `USDOS/LSIB_SIMPLE/2017` Somalia geometry | "Somalia" |
| **Region** | `FAO/GAUL/2015/level1` | "Banadir", "Bay", "Mudug" |
| **District** | `FAO/GAUL/2015/level2` | "Afgooye", "Baidoa" |

---

## 9. Key Index Formulas Reference

```
VCI  = 100 × (NDVI_current − NDVI_min) / (NDVI_max − NDVI_min)
TCI  = 100 × (LST_max − LST_current) / (LST_max − LST_min)
VHI  = 0.5 × VCI + 0.5 × TCI
CDI  = w_spi × SPI_stress + w_vhi × VHI_stress + w_smi × SMI_stress + w_spei × SPEI_stress
       (simplified linear composite, ICPAC-inspired — see §5/§9 disclosure note)
SPI  = (monthly_precip_total − yearly_climatology_mean) / yearly_climatology_std
       (one accumulated total per year feeds the climatology population, not pooled daily values)
SPEI = (monthly_precip − monthly_PET) standardised against yearly climatology of the same
       water balance; PET = ERA5-Land potential_evaporation_sum (real ET, not a rainfall-only proxy)
BSI  = (SWIR + Red − NIR − Blue) / (SWIR + Red + NIR + Blue)
FFSI = static(DEM + landcover + soil) × dynamic(GFS 3-day rain)
```

---

## 10. File Structure

```
somalia-ews/
├── backend/
│   ├── main.py              # FastAPI app, all API endpoints, AI prompt engine
│   ├── gee_utils.py         # All GEE layer/timeseries functions (1231 lines)
│   ├── flood_processor.py   # Flash flood FFSI + GFS rainfall risk engine
│   ├── preprocess_flood_data.py  # One-time static FFSI raster preprocessing
│   ├── water_sources.csv    # SWALIM water source survey data
│   ├── requirements.txt
│   └── .env                 # DEEPSEEK_API_KEY
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Map.jsx           # Main map component, sidebar, click handler (~1380 lines)
│       │   ├── MapDashboard.jsx  # Alt dashboard view
│       │   ├── Legend.jsx        # Dynamic legend per active layer
│       │   ├── AlertPanel.jsx    # Drought alert panel
│       │   └── FilterPanel.jsx   # Filter UI
│       ├── App.jsx
│       └── config.js            # API_BASE_URL config
├── flash floods base data/
│   └── somalia_basins_ffsi.geojson  # Preprocessed basin susceptibility index
├── gee-key.json             # GEE service account credentials
└── start.ps1 / start.bat    # Launch scripts for both servers
```
