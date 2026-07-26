"""AI-generated narrative insights (DeepSeek), for both historical
(SPI/VHI/SMI/SPEI/CDI) and short-term GFS forecast layers."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.cache import cache_get, cache_set, rate_limit_insights
from app.core.errors import api_error_response

router = APIRouter()


class AnalyzePayload(BaseModel):

    scope_level: str = "national"  # national, region, district

    scope_name: str = "Somalia"

    layer: str = "cdi"

    month: int = None

    year: int = None


@router.post("/api/insights/analyze", dependencies=[Depends(rate_limit_insights)])
def analyze_insights(payload: AnalyzePayload):

    try:

        import json
        import os
        from datetime import datetime

        from openai import OpenAI

        from app.services.gee_utils import (
            get_forecast_context,
            get_multi_index_context,
            get_season_info,
        )

        cache_key = f"{payload.scope_level}_{payload.scope_name}_{payload.layer.lower()}"

        cached = cache_get(cache_key)

        if cached is not None:

            return cached

        client = OpenAI(
            api_key=os.environ.get("DEEPSEEK_API_KEY"),
            base_url="https://api.deepseek.com",
            timeout=30.0,
        )

        if payload.layer.lower().startswith("forecast"):

            context = get_forecast_context(payload.scope_level, payload.scope_name)

            if "error" in context:

                return {"error": context["error"]}

            geography_type = payload.scope_level.capitalize()

            region_str = payload.scope_name

            prompt = f"""You are an experienced environmental analyst. Your task is to analyze short-term weather forecasts and produce clear, concise, and actionable insights for decision-makers.

Adopt the FAO SWALIM reporting style:

- ALWAYS begin the 'summary' and 'key_insights' by briefly reviewing the recently observed conditions/rainfall before interpreting the forecast.

- ALWAYS explicitly mention the data source "NOAA-NCEP GFS model" inside the summary.

- Transition naturally from past observations into forecast highlights and risks.

- If Geography is 'National', summarize spatial variations broadly across regions (e.g. northern vs southern pockets).

- If Geography is 'Region' or 'District', be highly localized. For districts, mention typical environmental pressures on settlements.

Focus on:

- Risk identification

- Trends across time windows

- Combined effects of rainfall and temperature

- Practical implications (water, drought, flood, heat)

INPUT DATA:

Geography Level: {geography_type}

Location: {region_str}

Past Month Observed Rainfall Anomaly (SPI): {context.get('past_spi', 0)} (Negative means deficit/dry, positive means surplus/wet)

Rainfall forecast (mm):

- 1 day: {context.get('r1', 0)}

- 3 days: {context.get('r3', 0)}

- 7 days: {context.get('r7', 0)}

- 14 days: {context.get('r14', 0)}

Temperature forecast ( degrees C):

- 1 day: {context.get('t1', 0)}

- 3 days: {context.get('t3', 0)}

- 7 days: {context.get('t7', 0)}

- 14 days: {context.get('t14', 0)}

Long-term mean 2m air temperature for this month (ERA5 climatology 2001-2020): {context.get('t_mean', 30.0)} degrees C

(Note: This is 2m AIR temperature, same variable as the GFS forecast values above. Normal air temp ranges for Somalia: highs of ~25-32 degrees C in cooler regions, ~35-42 degrees C in hot lowland regions.)

ANALYSIS RULES:

Rainfall:

- 0-5 mm = Dry

- 5-20 mm = Light

- 20-50 mm = Moderate

- >50 mm = Heavy

Temperature (compare forecast average against the ERA5 long-term mean provided above):

- Forecast avg within +/-1 degrees C of t_mean = Normal / no heat stress

- Forecast avg 1-2 degrees C ABOVE t_mean = Moderate heat stress

- Forecast avg >2 degrees C ABOVE t_mean = High heat stress

- IMPORTANT: Do NOT cite the raw forecast temperature value (e.g. 26 degrees C) as evidence of heat stress without comparing it to t_mean. Always state the anomaly relative to t_mean.

Interpretation logic:

- Low rainfall across multiple periods = dry spell

- Increasing rainfall = recovery signal

- High rainfall in short period = flood risk

- High temperature ANOMALY (above t_mean) + low rainfall = drought risk

- Rising temperature trend AND anomaly above t_mean = heat stress buildup

OUTPUT FORMAT (STRICT JSON):

{{

  "summary": "1 sentence reviewing past conditions, followed by 1 definitive sentence predicting the combined forecast impact.",

  "key_insights": [

     "Bullet 1 reviewing recent observations and linking to the short-term forecast",

     "Bullet 2 highlighting localized peaks or temperature extremes",

     "Bullet 3 summarizing risks"

  ],

  "risk_levels": {{

     "drought": "Low | Moderate | High",

     "flood": "Low | Moderate | High",

     "heat_stress": "Normal | Moderate | High",

     "water_availability": "Stable | Stressed | Critical"

  }},

  "trend_analysis": {{

     "rainfall": "Increasing | Decreasing | Unstable",

     "temperature": "Increasing | Stable | Decreasing"

  }},

  "early_warnings": ["Warning 1", "Warning 2"]

}}

"""

            response = client.chat.completions.create(
                model="deepseek-v4-flash",
                messages=[
                    {
                        "role": "system",
                        "content": "You are a senior environmental analyst. You ALWAYS respond with valid JSON only, following the exact strict schema provided.",
                    },
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.2,
            )

            text = response.choices[0].message.content

            if text.strip().startswith("```json"):
                text = text.strip()[7:].rstrip("`").strip()

            elif text.strip().startswith("```"):
                text = text.strip()[3:].rstrip("`").strip()

            data = json.loads(text)

            data["_raw_context"] = context

            data["isForecast"] = True

            # Attach forecast charts based on 16-day arrays

            charts = []

            if context.get("precip_ts"):

                charts.append(
                    {
                        "title": "Forecasted Precipitation (16 Days)",
                        "type": "bar",
                        "dataKey": "value",
                        "data": context["precip_ts"],
                        "isPercentage": False,
                        "explanation": "Cumulative 24-hour forecasted rainfall depth in millimeters.",
                    }
                )

            if context.get("temp_ts"):

                charts.append(
                    {
                        "title": "Forecasted Temperature (16 Days)",
                        "type": "line",
                        "dataKey": "avg",
                        "data": context["temp_ts"],
                        "isPercentage": False,
                        "explanation": "Average forecasted daily temperature in Celsius.",
                    }
                )

            data["charts"] = charts

            cache_set(cache_key, data)

            return data

        # Build date string from payload or default to current

        if payload.month and payload.year:

            target_date_str = f"{payload.year}-{payload.month:02d}-01"

            month = payload.month

        else:

            target_date_str = datetime.now().strftime("%Y-%m-01")

            month = datetime.now().month

        # 1. Fetch Multi-Index Context from GEE backend (Historical Branch)

        context = get_multi_index_context(
            payload.scope_level, payload.scope_name, payload.layer.lower(), target_date_str
        )

        if "error" in context:

            return {"error": context["error"]}

        # 2. Map GEE context fields â†’ analyst template variables

        geography_type = payload.scope_level.capitalize()  # National / Region / District

        region_or_district = context.get("region", payload.scope_name)

        season_name = context.get("season", get_season_info(month)["name"])

        # Rainfall: SPI is standardised (0 = mean).  Convert to a plain % description.

        spi_raw = context.get("spi", None)

        def spi_to_text(spi):

            if spi is None:
                return "Data not available"

            if spi <= -2.0:
                return f"Extremely below normal (SPI {spi:.2f})"

            if spi <= -1.5:
                return f"Severely below normal (SPI {spi:.2f})"

            if spi <= -1.0:
                return f"Moderately below normal (SPI {spi:.2f})"

            if spi <= -0.5:
                return f"Slightly below normal (SPI {spi:.2f})"

            if spi <= 0.5:
                return f"Near-normal (SPI {spi:.2f})"

            if spi <= 1.0:
                return f"Slightly above normal (SPI {spi:.2f})"

            return f"Well above normal (SPI {spi:.2f})"

        def vci_to_text(vci):

            if vci is None:
                return "Data not available"

            vci = round(vci, 1)

            if vci < 10:
                return f"Extreme vegetation stress (VCI {vci}%)"

            if vci < 25:
                return f"Severe vegetation stress (VCI {vci}%)"

            if vci < 40:
                return f"Moderate vegetation stress (VCI {vci}%)"

            if vci < 60:
                return f"Near-normal vegetation (VCI {vci}%)"

            return f"Good / healthy vegetation (VCI {vci}%)"

        def tci_to_text(tci):

            if tci is None:
                return "Data not available"

            tci = round(tci, 1)

            if tci < 20:
                return f"Extreme heat stress (TCI {tci}%)"

            if tci < 35:
                return f"High heat stress (TCI {tci}%)"

            if tci < 50:
                return f"Moderate heat (TCI {tci}%)"

            return f"Temperature within normal range (TCI {tci}%)"

        def cdi_to_text(cdi):

            if cdi is None:
                return "Data not available"

            cdi = round(cdi, 2)

            if cdi > 0.8:
                return f"Extreme combined drought stress (CDI {cdi})"

            if cdi > 0.6:
                return f"Severe combined drought stress (CDI {cdi})"

            if cdi > 0.4:
                return f"Moderate combined drought stress (CDI {cdi})"

            if cdi > 0.2:
                return f"Watch level - early drought signals (CDI {cdi})"

            return f"Normal / no drought signal (CDI {cdi})"

        rainfall_anomaly_text = spi_to_text(spi_raw)

        vci_text = vci_to_text(context.get("vci"))

        tci_text = tci_to_text(context.get("tci"))

        cdi_text = cdi_to_text(context.get("cdi"))

        trend_raw = context.get("trend", "stable")

        # context["trend"] is already "improving"/"worsening"/"stable" (see
        # get_multi_index_context in gee_utils.py) — no remapping needed.
        trend_text = trend_raw

        prev_season = context.get("previous_season_performance", "unknown")

        prev_season_label = context.get("previous_season_label", "previous rainy season")

        prev_season_spi = context.get("previous_season_spi", 0)

        if prev_season == "below normal":

            prev_text = (
                f"{prev_season_label} rainfall was significantly below normal "
                f"(mean SPI {prev_season_spi:.2f}). This failed season is a key driver of current vulnerability."
            )

        elif prev_season == "above normal":

            prev_text = (
                f"{prev_season_label} rainfall was above normal "
                f"(mean SPI {prev_season_spi:.2f}). Vegetation and water buffers should have been partially restored."
            )

        else:

            prev_text = (
                f"{prev_season_label} rainfall was normal " f"(mean SPI {prev_season_spi:.2f})."
            )

        prev2_season = context.get("prev2_season_performance", "unknown")

        prev2_season_label = context.get("prev2_season_label", "older rainy season")

        prev2_season_spi = context.get("prev2_season_spi", 0)

        if prev2_season == "below normal":

            prev2_text = (
                f"Before that, {prev2_season_label} rainfall was also below normal "
                f"(mean SPI {prev2_season_spi:.2f}), creating compound stress."
            )

        elif prev2_season == "above normal":

            prev2_text = (
                f"Before that, {prev2_season_label} rainfall was above normal "
                f"(mean SPI {prev2_season_spi:.2f}), which provided some historical buffer."
            )

        else:

            prev2_text = (
                f"Before that, {prev2_season_label} rainfall was normal "
                f"(mean SPI {prev2_season_spi:.2f})."
            )

        seasonal_note = ""

        if context.get("seasonal_correction_applied"):

            seasonal_note = " (Note: seasonal correction applied - dry-season drought signal suppressed due to good previous rains.)"

        # 3-month SPI trend series

        spi_series = context.get("spi_3month_series", {})

        spi_trend_text = (
            f"SPI 2 months ago: {spi_series.get('prev_2mo', 'N/A')}, "
            f"1 month ago: {spi_series.get('prev_1mo', 'N/A')}, "
            f"current month: {spi_series.get('current', 'N/A')}"
        )

        # Layer-specific indicator value for the active view

        layer_specific_text = ""

        lt = payload.layer.lower()

        if lt == "smi":

            sm = context.get("soil_moisture")

            layer_specific_text = f"Soil Moisture Anomaly (FLDAS 1982-baseline): {sm if sm is not None else 'Not available'} (negative = deficit, positive = surplus)"

        elif lt == "spei":

            sp = context.get("spei")

            layer_specific_text = f"SPEI (drought-evapotranspiration index): {sp if sp is not None else 'Not available'} (negative = dry, positive = wet)"

        elif lt == "vhi":

            vh = context.get("vhi")

            layer_specific_text = f"Vegetation Health Index (0-100): {vh if vh is not None else 'Not available'} (below 40 = stressed, above 60 = healthy)"

        elif lt == "bsi":

            bs = context.get("bsi")

            layer_specific_text = f"Bare Soil Index (Sentinel-2): {bs if bs is not None else 'Not available'} (higher = more exposed bare ground / land degradation)"

        elif lt == "cdi":

            layer_specific_text = f"Combined Drought Index: {cdi_text}"

        elif lt in ("temp_anomaly", "tci"):

            hl = context.get("heat_label", "")

            layer_specific_text = f"Temperature condition: {hl} (TCI: {context.get('tci', 'N/A')}%)"

        # LTM reference descriptions

        ltm_rainfall = "1991-2020 CHIRPS climatology (30-year baseline)"

        ltm_ndvi = (
            "MODIS NDVI long-term min/max (2000-present) used for vegetation condition scoring"
        )

        ltm_temp = (
            "MODIS LST long-term min/max (2000-present) used for temperature condition scoring"
        )

        # 3. Build the rigorous analyst prompt

        prompt = f"""You are an environmental analyst supporting government decision-makers in Somalia.

Your task is to interpret environmental data and produce clear, accurate, and actionable insights.

----------------------------------

CRITICAL RULES (MUST FOLLOW)

----------------------------------

1. ALWAYS use LONG-TERM CLIMATOLOGY as the primary performance baseline.

   - Compare current conditions against long-term averages (minimum 20-30 years).

2. ALWAYS use previous rainy seasons (e.g. Deyr, Gu) as PRIMARY DRIVERS.

   - If the previous season(s) failed or was drier than normal, explicitly highlight this as a foundational driver causing the current vulnerability and stress.

   - Consider the compound effect of both the most recent season and the season prior to that.

3. Avoid weak or misleading language:

   - Do NOT say "slightly dry" if anomaly is significant.

   - Do NOT assume stability without trend evidence.

4. Always check consistency:

   - If rainfall anomaly is large, reflect it clearly in the situation.

   - Do not contradict data.

5. Focus on decision usefulness:

   - Explain what is happening

   - Explain why (drivers) - trace current conditions to previous rainy season performance if it was detrimental.

   - Explain what it means (impact)

   - Provide actions

6. Use simple, non-technical language.

   - Do NOT mention SPI, NDVI, VCI, TCI, CDI, or any technical index names.

   - Translate them into real-world meaning.

7. Geography-specific rules:

   - If Geography Type is 'Region', explicitly list the districts within it and discuss how conditions might vary across them.

   - If Geography Type is 'District', emphasize potential impacts on major settlements within that district.

----------------------------------

INPUT CONTEXT

----------------------------------

Geography Type: {geography_type}

Location: {region_or_district}

Season: {season_name}{seasonal_note}

Current Indicators (all values are satellite-derived, region-aggregated means):

- Rainfall anomaly vs 30-year mean: {rainfall_anomaly_text}

- Vegetation condition vs historical norm: {vci_text}

- Temperature / heat stress condition: {tci_text}

- Combined drought stress level: {cdi_text}

- Active layer specific value: {layer_specific_text if layer_specific_text else 'See above indicators'}

Historical Reference (Long-Term Climatology):

- Rainfall baseline: {ltm_rainfall}

- Vegetation baseline: {ltm_ndvi}

- Temperature baseline: {ltm_temp}

Previous Seasonal Context (Drivers):

- Most recent season: {prev_text}

- Season before that: {prev2_text}

3-Month Rainfall Trend (SPI anomaly sequence):

- {spi_trend_text}

- Overall direction: {trend_text} (based on comparison of current vs previous 2 months)

Previous Completed Rainy Season Performance:

- {prev_text}

----------------------------------

ANALYSIS INSTRUCTIONS

----------------------------------

You MUST:

1. Compare current rainfall to long-term average and describe deficit or surplus clearly.

2. Directly evaluate how the previous rainy season's performance (Deyr or Gu) acts as a driver for the current conditions.

3. Assess vegetation condition relative to normal seasonal behaviour.

4. Evaluate whether conditions are improving or worsening based on trend.

5. Determine if current conditions indicate: Normal, Watch, Moderate concern, or Severe risk.

6. Ensure: no contradictions, and no assumptions without data.

----------------------------------

OUTPUT FORMAT (STRICT JSON)

----------------------------------

Return ONLY valid JSON with EXACTLY this structure (no markdown, no extra keys):

{{

  "situation": "Clear summary of what is happening right now compared to long-term norms",

  "drivers": ["driver 1", "driver 2"],

  "impact": ["real-world effect 1", "real-world effect 2"],

  "risk_level": "Normal | Watch | Moderate | Severe",

  "recommendations": ["action 1", "action 2", "action 3"],

  "confidence_note": "Short note on data quality or limitations"

}}

"""

        # 4. Call DeepSeek

        response = client.chat.completions.create(
            model="deepseek-v4-flash",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a senior environmental analyst. "
                        "You ALWAYS respond with valid JSON only, following the exact schema provided. "
                        "You NEVER use technical index names (SPI, NDVI, VCI, TCI, CDI). "
                        "You ALWAYS compare against long-term climatology as primary reference."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.2,  # Lower temp â†’ more consistent, less hallucination
        )

        text = response.choices[0].message.content

        # Safety fallback: strip markdown fences if present

        if text.strip().startswith("```json"):
            text = text.strip()[7:].rstrip("`").strip()

        elif text.strip().startswith("```"):
            text = text.strip()[3:].rstrip("`").strip()

        data = json.loads(text)

        # Attach raw GEE context so frontend can use it if needed

        data["_raw_context"] = context

        # Build 4-index charts for the Intelligence Dashboard (parallel fetch)

        import concurrent.futures

        from app.services.gee_utils import (
            get_smi_timeseries,
            get_spei_timeseries,
            get_spi_timeseries,
            get_vhi_timeseries,
        )

        charts = []

        if centroid_coords := context.get("centroid"):

            lon, lat = centroid_coords

            try:

                with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:

                    f_spi = executor.submit(get_spi_timeseries, lat, lon)

                    f_vhi = executor.submit(get_vhi_timeseries, lat, lon)

                    f_smi = executor.submit(get_smi_timeseries, lat, lon)

                    f_spei = executor.submit(get_spei_timeseries, lat, lon)

                    charts.append(
                        {
                            "title": "Rainfall Anomaly (12-Month)",
                            "type": "bar",
                            "dataKey": "value",
                            "data": f_spi.result(),
                            "explanation": "Blue bars = above-average rainfall. Red bars = below-average (drier conditions).",
                        }
                    )

                    charts.append(
                        {
                            "title": "Vegetation Health (12-Month VHI)",
                            "type": "line",
                            "dataKey": "value",
                            "data": f_vhi.result(),
                            "explanation": "Tracks vegetation health 0-100. Below 40 = stressed. Above 60 = healthy.",
                        }
                    )

                    charts.append(
                        {
                            "title": "Soil Moisture Anomaly (12-Month)",
                            "type": "line",
                            "dataKey": "value",
                            "data": f_smi.result(),
                            "explanation": "Negative values = soil moisture deficit. Positive = surplus.",
                        }
                    )

                    charts.append(
                        {
                            "title": "Water Balance Anomaly (12-Month SPEI)",
                            "type": "line",
                            "dataKey": "value",
                            "data": f_spei.result(),
                            "explanation": "Negative = dry water balance (more ET than rainfall). Positive = wet.",
                        }
                    )

            except Exception as e:

                print(f"Timeseries extraction failed: {e}")

        data["charts"] = charts

        # Add normalized_scores from GEE context if available

        if ns := context.get("normalized_scores"):

            data["normalized_scores"] = ns

        cache_set(cache_key, data)

        return data

    except Exception as e:

        return api_error_response(e)


# --- Flash Flood Early Warning Layer ---
