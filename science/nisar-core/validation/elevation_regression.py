"""Robust empirical phase-elevation regression for GUNW only."""
from __future__ import annotations

from typing import Any, Literal

import numpy as np


def _theil_sen(x: np.ndarray, y: np.ndarray) -> tuple[float, float]:
    differences = x[:, None] - x[None, :]
    valid = np.triu(np.abs(differences) > 0, 1)
    slopes = (y[:, None] - y[None, :])[valid] / differences[valid]
    slope = float(np.median(slopes))
    return slope, float(np.median(y - slope * x))


def fit_elevation_phase_trend(
    phase_los_m: np.ndarray,
    dem_elevation_m: np.ndarray,
    support_mask: np.ndarray,
    product_family: Literal["GUNW", "GOFF"],
    *,
    min_correlation: float = 0.40,
    max_leverage_ratio: float = 3.0,
) -> dict[str, Any]:
    """Estimate and optionally remove a stratified GUNW phase-elevation trend."""
    if product_family == "GOFF":
        raise ValueError("Tropospheric elevation regression forbidden for GOFF")
    phase, elevation, mask = map(lambda value: np.asarray(value, dtype=float), (phase_los_m, dem_elevation_m, support_mask))
    if phase.shape != elevation.shape or phase.shape != mask.shape or phase.ndim != 2:
        raise ValueError("WITHHELD_INVALID_ELEVATION_REGRESSION_INPUT")
    valid = mask.astype(bool) & np.isfinite(phase) & np.isfinite(elevation)
    x, y = elevation[valid], phase[valid]
    if x.size < 6 or np.ptp(x) <= 0:
        return {"status": "WITHHELD_INSUFFICIENT_ELEVATION_SUPPORT", "applied": False, "corrected_raster": phase_los_m}
    q25, q75 = np.percentile(x, [25, 75])
    iqr = q75 - q25
    leverage = np.ptp(x) / iqr if iqr > 0 else float("inf")
    if leverage > max_leverage_ratio:
        return {"status": "FLAGGED_EXCESSIVE_LEVERAGE", "applied": False, "leverage_ratio": leverage, "corrected_raster": phase_los_m}
    correlation = float(np.corrcoef(x, y)[0, 1])
    if not np.isfinite(correlation) or abs(correlation) < min_correlation:
        return {"status": "FLAGGED_LOW_CORRELATION", "applied": False, "correlation_r": correlation, "corrected_raster": phase_los_m}
    slope, intercept = _theil_sen(x, y)
    corrected = phase - (slope * elevation + intercept)
    return {
        "status": "APPLIED", "applied": True, "slope_mm_per_km": slope * 1_000_000.0,
        "correlation_r": correlation, "explained_variance_pct": float(correlation ** 2 * 100.0),
        "corrected_raster": corrected,
    }
