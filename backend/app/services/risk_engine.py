"""
risk_engine.py — ICPAC-Inspired Normalization & CDI Risk Engine
Somalia EWS / Sahan Platform — TerraTech Solutions

All drought stress scores follow the ICPAC 0.0 (no stress) to 1.0 (extreme stress) scale.

METHODOLOGY NOTE: The CDI computed here is a simplified linear composite
(seasonally-weighted sum of normalized SPI/VHI/SMI/SPEI stress), chosen for
computational simplicity and near-real-time responsiveness. It is inspired by,
but is NOT the same as, the published ICPAC/JRC-EDO Combined Drought Indicator
methodology (Sepulcre-Cantó et al., 2012), which uses a categorical
Watch -> Warning -> Alert decision tree rather than a weighted average. The
specific seasonal weights below are this project's own calibration and have
not yet been externally validated against an ICPAC reference dataset.
"""

# ------------------------------------------------------------------
# Somalia Seasonal Calendar
# ------------------------------------------------------------------
SEASONS = [
    {"name": "Jilaal", "months": [1, 2, 3], "type": "dry"},
    {"name": "Gu", "months": [4, 5, 6], "type": "rainy"},
    {"name": "Xagaa", "months": [7, 8, 9], "type": "dry"},
    {"name": "Deyr", "months": [10, 11, 12], "type": "rainy"},
]

# ------------------------------------------------------------------
# Seasonal Weighting Matrix — project calibration, not an external ICPAC citation
# (see module docstring above)
# ------------------------------------------------------------------
WEIGHTS_RAINY = {"spi": 0.30, "vhi": 0.25, "smi": 0.20, "spei": 0.25}
WEIGHTS_DRY = {"spi": 0.50, "vhi": 0.35, "smi": 0.15, "spei": 0.00}

# ------------------------------------------------------------------
# Drought Severity Classification (0-1 CDI scale, ICPAC-inspired)
# Project-defined thresholds; not a verified external WMO/ICPAC citation.
# ------------------------------------------------------------------
WMO_THRESHOLDS = [
    (0.80, "Extreme", "#990000"),
    (0.60, "Severe", "#ff0000"),
    (0.40, "Moderate", "#ff9900"),
    (0.20, "Watch", "#ffff00"),
    (0.00, "Normal", "#05e100"),
]


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def _clamp(value, lo, hi):
    return max(lo, min(hi, value))


def get_season_info(month: int) -> dict:
    for s in SEASONS:
        if month in s["months"]:
            return s
    return SEASONS[0]


def get_seasonal_weights(month: int) -> dict:
    season = get_season_info(month)
    return WEIGHTS_RAINY if season["type"] == "rainy" else WEIGHTS_DRY


# ------------------------------------------------------------------
# ICPAC Index Normalization (scalar — Python floats)
# ------------------------------------------------------------------
def normalize_spi(spi) -> float:
    """SPI stress: abs(clamp(spi, -3, 0)) / 3.0"""
    if spi is None:
        return 0.0
    return abs(_clamp(float(spi), -3.0, 0.0)) / 3.0


def normalize_vhi(vhi) -> float:
    """VHI stress: 1.0 - (vhi / 100.0)"""
    if vhi is None:
        return 0.5  # neutral default when data absent
    return _clamp(1.0 - float(vhi) / 100.0, 0.0, 1.0)


def normalize_smi(smi_anomaly) -> float:
    """SMI stress: abs(clamp(smi_anomaly, -3, 0)) / 3.0"""
    if smi_anomaly is None:
        return 0.0
    return abs(_clamp(float(smi_anomaly), -3.0, 0.0)) / 3.0


def normalize_spei(spei) -> float:
    """SPEI stress: abs(clamp(spei, -3, 0)) / 3.0"""
    if spei is None:
        return 0.0
    return abs(_clamp(float(spei), -3.0, 0.0)) / 3.0


# ------------------------------------------------------------------
# CDI Composite (scalar)
# ------------------------------------------------------------------
def compute_cdi(spi, vhi, smi_anomaly, spei, month: int) -> float:
    """
    Compute the ICPAC-inspired CDI (0.0-1.0) from normalized inputs.
    Uses the seasonal weighting matrix defined above (project calibration).
    """
    w = get_seasonal_weights(month)
    cdi = (
        w["spi"] * normalize_spi(spi)
        + w["vhi"] * normalize_vhi(vhi)
        + w["smi"] * normalize_smi(smi_anomaly)
        + w["spei"] * normalize_spei(spei)
    )
    return round(_clamp(cdi, 0.0, 1.0), 4)


# ------------------------------------------------------------------
# WMO Classification
# ------------------------------------------------------------------
def classify_cdi(cdi_score: float) -> dict:
    """Return WMO status label and hex colour for a CDI value."""
    for threshold, status, color in WMO_THRESHOLDS:
        if cdi_score >= threshold:
            return {"status": status, "color": color, "score": round(cdi_score, 4)}
    return {"status": "Normal", "color": "#05e100", "score": round(cdi_score, 4)}


# ------------------------------------------------------------------
# Trend Detection
# ------------------------------------------------------------------
def compute_trend(current, prev1, prev2) -> str:
    """
    Compare current stress value against the average of two prior months.
    Returns: 'worsening' | 'improving' | 'stable'
    """
    vals = [v for v in [prev1, prev2] if v is not None]
    if not vals:
        return "stable"
    avg_prev = sum(vals) / len(vals)
    diff = (current or 0) - avg_prev
    if diff > 0.05:
        return "worsening"
    if diff < -0.05:
        return "improving"
    return "stable"


# ------------------------------------------------------------------
# GEE Image-level normalization (returns ee.Image)
# ------------------------------------------------------------------
def gee_normalize_spi(spi_img):
    """Apply ICPAC SPI normalization to a GEE image."""

    return spi_img.clamp(-3, 0).abs().divide(3).rename("spi_stress")


def gee_normalize_vhi(vhi_img):
    """Apply ICPAC VHI normalization to a GEE image (VHI is 0–100)."""
    import ee

    return ee.Image(1).subtract(vhi_img.divide(100)).clamp(0, 1).rename("vhi_stress")


def gee_normalize_smi(smi_img):
    """Apply ICPAC SMI normalization to a GEE anomaly image."""

    return smi_img.clamp(-3, 0).abs().divide(3).rename("smi_stress")


def gee_normalize_spei(spei_img):
    """Apply ICPAC SPEI normalization to a GEE anomaly image."""

    return spei_img.clamp(-3, 0).abs().divide(3).rename("spei_stress")


def gee_compute_cdi(spi_img, vhi_img, smi_img, spei_img, month: int):
    """
    Compute CDI as a GEE image using ICPAC seasonal weights.
    All inputs must already be normalized to 0–1 stress scale.
    """

    w = get_seasonal_weights(month)
    return (
        spi_img.multiply(w["spi"])
        .add(vhi_img.multiply(w["vhi"]))
        .add(smi_img.multiply(w["smi"]))
        .add(spei_img.multiply(w["spei"]))
        .clamp(0, 1)
        .rename("cdi")
    )
