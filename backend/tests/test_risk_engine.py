"""Tests for the pure-Python (no GEE credentials needed) drought risk logic
in app.services.risk_engine: season classification, seasonal weight
matrices, index normalization, CDI composition, classification thresholds,
and trend detection."""

import pytest

from app.services.risk_engine import (
    SEASONS,
    WEIGHTS_DRY,
    WEIGHTS_RAINY,
    classify_cdi,
    compute_cdi,
    compute_trend,
    get_season_info,
    get_seasonal_weights,
    normalize_smi,
    normalize_spei,
    normalize_spi,
    normalize_vhi,
)


class TestSeasonInfo:
    @pytest.mark.parametrize(
        "month,expected_name,expected_type",
        [
            (1, "Jilaal", "dry"),
            (2, "Jilaal", "dry"),
            (3, "Jilaal", "dry"),
            (4, "Gu", "rainy"),
            (5, "Gu", "rainy"),
            (6, "Gu", "rainy"),
            (7, "Xagaa", "dry"),
            (8, "Xagaa", "dry"),
            (9, "Xagaa", "dry"),
            (10, "Deyr", "rainy"),
            (11, "Deyr", "rainy"),
            (12, "Deyr", "rainy"),
        ],
    )
    def test_every_month_maps_to_correct_season(self, month, expected_name, expected_type):
        season = get_season_info(month)
        assert season["name"] == expected_name
        assert season["type"] == expected_type

    def test_all_twelve_months_are_covered_exactly_once(self):
        covered = sorted(m for s in SEASONS for m in s["months"])
        assert covered == list(range(1, 13))


class TestSeasonalWeights:
    def test_rainy_weights_sum_to_one(self):
        assert sum(WEIGHTS_RAINY.values()) == pytest.approx(1.0)

    def test_dry_weights_sum_to_one(self):
        assert sum(WEIGHTS_DRY.values()) == pytest.approx(1.0)

    def test_get_seasonal_weights_selects_rainy_for_gu(self):
        assert get_seasonal_weights(5) == WEIGHTS_RAINY

    def test_get_seasonal_weights_selects_dry_for_jilaal(self):
        assert get_seasonal_weights(2) == WEIGHTS_DRY

    def test_spei_weight_is_zero_in_dry_season(self):
        # Dry-season CDI intentionally excludes SPEI (see risk_engine module docstring).
        assert WEIGHTS_DRY["spei"] == 0.0


class TestNormalization:
    def test_normalize_spi_none_returns_zero_stress(self):
        assert normalize_spi(None) == 0.0

    def test_normalize_spi_at_zero_is_no_stress(self):
        assert normalize_spi(0.0) == 0.0

    def test_normalize_spi_at_negative_three_is_max_stress(self):
        assert normalize_spi(-3.0) == 1.0

    def test_normalize_spi_clamps_beyond_negative_three(self):
        assert normalize_spi(-10.0) == 1.0

    def test_normalize_spi_ignores_positive_values(self):
        # Positive SPI (wetter than normal) is not "stress" — clamped to 0.
        assert normalize_spi(2.5) == 0.0

    def test_normalize_vhi_none_returns_neutral_default(self):
        assert normalize_vhi(None) == 0.5

    def test_normalize_vhi_at_100_is_no_stress(self):
        assert normalize_vhi(100.0) == 0.0

    def test_normalize_vhi_at_zero_is_max_stress(self):
        assert normalize_vhi(0.0) == 1.0

    def test_normalize_smi_matches_spi_shape(self):
        assert normalize_smi(None) == 0.0
        assert normalize_smi(-1.5) == pytest.approx(0.5)

    def test_normalize_spei_matches_spi_shape(self):
        assert normalize_spei(None) == 0.0
        assert normalize_spei(-3.0) == 1.0


class TestComputeCDI:
    def test_all_normal_inputs_give_zero_cdi(self):
        # SPI=0 (no deficit), VHI=100 (healthy), SMI=0, SPEI=0 -> zero stress across the board.
        cdi = compute_cdi(spi=0.0, vhi=100.0, smi_anomaly=0.0, spei=0.0, month=5)
        assert cdi == 0.0

    def test_extreme_drought_inputs_give_cdi_near_one(self):
        cdi = compute_cdi(spi=-3.0, vhi=0.0, smi_anomaly=-3.0, spei=-3.0, month=5)
        assert cdi == pytest.approx(1.0)

    def test_matches_hand_computed_rainy_season_value(self):
        # Rainy season weights: spi=0.30, vhi=0.25, smi=0.20, spei=0.25
        # spi=-1.5 -> stress 0.5; vhi=50 -> stress 0.5; smi=0 -> 0; spei=0 -> 0
        expected = 0.30 * 0.5 + 0.25 * 0.5
        cdi = compute_cdi(spi=-1.5, vhi=50.0, smi_anomaly=0.0, spei=0.0, month=5)
        assert cdi == pytest.approx(expected, abs=1e-4)

    def test_dry_season_ignores_spei_entirely(self):
        # SPEI weight is 0 in dry season, so an extreme SPEI value shouldn't move the score.
        base = compute_cdi(spi=-1.0, vhi=60.0, smi_anomaly=-1.0, spei=0.0, month=2)
        with_extreme_spei = compute_cdi(spi=-1.0, vhi=60.0, smi_anomaly=-1.0, spei=-3.0, month=2)
        assert base == with_extreme_spei

    def test_cdi_is_clamped_to_zero_one_range(self):
        cdi = compute_cdi(spi=-100.0, vhi=-100.0, smi_anomaly=-100.0, spei=-100.0, month=5)
        assert 0.0 <= cdi <= 1.0


class TestClassifyCDI:
    @pytest.mark.parametrize(
        "score,expected_status",
        [
            (0.0, "Normal"),
            (0.19, "Normal"),
            (0.20, "Watch"),
            (0.39, "Watch"),
            (0.40, "Moderate"),
            (0.59, "Moderate"),
            (0.60, "Severe"),
            (0.79, "Severe"),
            (0.80, "Extreme"),
            (1.0, "Extreme"),
        ],
    )
    def test_threshold_boundaries(self, score, expected_status):
        assert classify_cdi(score)["status"] == expected_status

    def test_returns_score_rounded_to_four_places(self):
        result = classify_cdi(0.123456789)
        assert result["score"] == 0.1235


class TestComputeTrend:
    def test_no_prior_data_is_stable(self):
        assert compute_trend(current=0.5, prev1=None, prev2=None) == "stable"

    def test_increasing_stress_is_worsening(self):
        assert compute_trend(current=0.8, prev1=0.5, prev2=0.5) == "worsening"

    def test_decreasing_stress_is_improving(self):
        assert compute_trend(current=0.2, prev1=0.5, prev2=0.5) == "improving"

    def test_small_change_is_stable(self):
        assert compute_trend(current=0.51, prev1=0.5, prev2=0.5) == "stable"

    def test_handles_a_single_missing_prior_month(self):
        # Should average over whichever prior values are available.
        assert compute_trend(current=0.9, prev1=0.5, prev2=None) == "worsening"
