"""Optional NoData-safe speckle filtering for RiverShift classifier variants."""

from __future__ import annotations

import numpy as np
from scipy import ndimage


def lee_filter_power(
    power: np.ndarray,
    valid: np.ndarray,
    *,
    size: int = 5,
    enl: float = 4.0,
) -> np.ndarray:
    """Apply a conservative Lee filter in linear power space.

    This is an optional method variant. It must be evaluated against an
    independent reference because smoothing can move narrow river boundaries.
    """
    array = np.asarray(power, dtype=np.float64)
    support = np.asarray(valid, dtype=bool)
    if array.shape != support.shape:
        raise ValueError("power and valid must have identical shapes.")
    if size < 3 or size % 2 == 0:
        raise ValueError("size must be an odd integer of at least 3.")
    if not np.isfinite(enl) or enl <= 0:
        raise ValueError("enl must be finite and greater than zero.")
    observed = support & np.isfinite(array) & (array > 0)
    weights = observed.astype(np.float64)
    denominator = ndimage.uniform_filter(weights, size=size, mode="nearest")
    denominator = np.maximum(denominator, 1e-12)
    mean = ndimage.uniform_filter(np.where(observed, array, 0.0), size=size, mode="nearest") / denominator
    second = ndimage.uniform_filter(np.where(observed, array * array, 0.0), size=size, mode="nearest") / denominator
    variance = np.maximum(second - mean * mean, 0.0)
    coefficient_squared = variance / np.maximum(mean * mean, 1e-30)
    weight = np.clip(1.0 - (1.0 / enl) / np.maximum(coefficient_squared, 1e-12), 0.0, 1.0)
    result = mean + weight * (array - mean)
    result[~observed | (denominator < 0.5)] = np.nan
    return result
