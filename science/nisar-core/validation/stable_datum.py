"""High-Coherence Low-Variance ensemble stable datum estimation."""
from __future__ import annotations

import numpy as np


def compute_hclv_support_mask(
    coherence_stack: np.ndarray,
    variance_stack: np.ndarray,
    *,
    min_mean_coherence: float = 0.65,
    max_variance_percentile: float = 40.0,
    slope_degrees: np.ndarray | None = None,
    max_slope_deg: float = 20.0,
) -> np.ndarray:
    """Identify a sufficiently large HCLV support ensemble, or withhold."""
    coherence = np.asarray(coherence_stack, dtype=float)
    variance = np.asarray(variance_stack, dtype=float)
    if coherence.ndim < 2 or variance.shape != coherence.shape or not 0 < max_variance_percentile <= 100:
        raise ValueError("WITHHELD_INVALID_STABLE_DATUM_INPUT")
    if slope_degrees is not None and np.asarray(slope_degrees).shape != coherence.shape[-2:]:
        raise ValueError("WITHHELD_INVALID_STABLE_DATUM_SLOPE")
    mean_coherence = np.nanmean(coherence, axis=0)
    mean_variance = np.nanmean(variance, axis=0)
    valid_variance = mean_variance[np.isfinite(mean_variance)]
    if valid_variance.size == 0:
        raise ValueError("WITHHELD_INSUFFICIENT_STABLE_SUPPORT")
    variance_limit = float(np.nanpercentile(valid_variance, max_variance_percentile))
    mask = np.isfinite(mean_coherence) & np.isfinite(mean_variance)
    mask &= mean_coherence >= min_mean_coherence
    mask &= mean_variance <= variance_limit
    if slope_degrees is not None:
        slope = np.asarray(slope_degrees, dtype=float)
        mask &= np.isfinite(slope) & (slope <= max_slope_deg)
    minimum_required = max(500, int(np.ceil(mask.size * 0.03)))
    if int(mask.sum()) < minimum_required:
        raise ValueError("WITHHELD_INSUFFICIENT_STABLE_SUPPORT")
    return mask


def apply_ensemble_datum(
    raster: np.ndarray,
    support_mask: np.ndarray,
    *,
    weights: np.ndarray | None = None,
) -> tuple[np.ndarray, float]:
    """Subtract the weighted median support displacement from a raster."""
    field = np.asarray(raster, dtype=float)
    mask = np.asarray(support_mask, dtype=bool)
    if field.ndim != 2 or field.shape != mask.shape or not mask.any():
        raise ValueError("WITHHELD_INSUFFICIENT_STABLE_SUPPORT")
    valid_mask = mask & np.isfinite(field)
    values = field[valid_mask]
    if values.size == 0:
        raise ValueError("WITHHELD_INSUFFICIENT_STABLE_SUPPORT")
    if weights is None:
        shift = float(np.median(values))
    else:
        weight_values = np.asarray(weights, dtype=float)[valid_mask]
        if weight_values.shape != values.shape or not np.all(np.isfinite(weight_values)) or np.any(weight_values < 0) or weight_values.sum() <= 0:
            raise ValueError("WITHHELD_INVALID_STABLE_DATUM_WEIGHTS")
        order = np.argsort(values)
        cumulative = np.cumsum(weight_values[order])
        shift = float(values[order[np.searchsorted(cumulative, cumulative[-1] / 2)]])
    return field - shift, shift
