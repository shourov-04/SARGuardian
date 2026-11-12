import numpy as np
import pytest

from validation.stable_datum import apply_ensemble_datum, compute_hclv_support_mask


def test_hclv_support_filters_coherence_and_slope() -> None:
    shape = (25, 25)
    coherence = np.full((3, *shape), 0.9)
    variance = np.full((3, *shape), 1.0)
    slope = np.full(shape, 5.0)
    coherence[:, 0, 0] = 0.1
    slope[0, 1] = 40
    mask = compute_hclv_support_mask(coherence, variance, slope_degrees=slope)
    assert not mask[0, 0]
    assert not mask[0, 1]
    assert mask.sum() >= 500 if mask.size >= 500 else mask.sum() >= mask.size * 0.03


def test_insufficient_support_withholds() -> None:
    with pytest.raises(ValueError, match="WITHHELD_INSUFFICIENT_STABLE_SUPPORT"):
        compute_hclv_support_mask(np.full((2, 20, 20), 0.9), np.ones((2, 20, 20)))


def test_datum_shift_centers_support_median() -> None:
    raster = np.full((30, 30), 0.0)
    raster[5:25, 5:25] = 12.0
    mask = np.zeros_like(raster, dtype=bool)
    mask[5:25, 5:25] = True
    referenced, shift = apply_ensemble_datum(raster, mask)
    assert shift == 12.0
    assert np.median(referenced[mask]) == 0.0
