import numpy as np
import pytest

from validation.elevation_regression import fit_elevation_phase_trend


def test_known_elevation_gradient_is_recovered() -> None:
    elevation = np.arange(100, dtype=float).reshape(10, 10) * 100.0
    phase = elevation * 0.005 / 1000.0
    result = fit_elevation_phase_trend(phase, elevation, np.ones_like(phase, dtype=bool), "GUNW")
    assert result["applied"] is True
    assert result["slope_mm_per_km"] == pytest.approx(5.0, abs=0.01)


def test_goff_elevation_regression_is_forbidden() -> None:
    with pytest.raises(ValueError, match="forbidden for GOFF"):
        fit_elevation_phase_trend(np.ones((4, 4)), np.ones((4, 4)), np.ones((4, 4), dtype=bool), "GOFF")


def test_low_correlation_does_not_change_input() -> None:
    phase = np.random.default_rng(1).normal(size=(8, 8))
    elevation = np.arange(64, dtype=float).reshape(8, 8)
    result = fit_elevation_phase_trend(phase, elevation, np.ones_like(phase, dtype=bool), "GUNW")
    assert result["status"] == "FLAGGED_LOW_CORRELATION"
    np.testing.assert_array_equal(result["corrected_raster"], phase)
