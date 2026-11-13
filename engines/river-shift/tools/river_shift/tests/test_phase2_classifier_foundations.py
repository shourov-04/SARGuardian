import numpy as np
import pytest

from river_shift.exclusion_masks import apply_exclusion_masks
from river_shift.speckle import lee_filter_power
from river_shift.water_detection import (
    classify_open_water,
    otsu_threshold_diagnostics,
)


def test_otsu_diagnostics_reports_reliability_fields() -> None:
    values = np.concatenate([np.full(200, -24.0), np.full(200, -4.0)])
    diagnostics = otsu_threshold_diagnostics(values, np.ones(values.shape, dtype=bool))

    assert diagnostics.valid_count == 400
    assert np.isfinite(diagnostics.threshold_db)
    assert diagnostics.separability is not None
    assert isinstance(diagnostics.reliable, bool)
    assert diagnostics.as_dict()["interpretation"]


def test_minimum_mapping_unit_requires_pixel_area() -> None:
    values = np.full((5, 5), 0.01, dtype=float)
    with pytest.raises(ValueError, match="pixel_area_m2"):
        classify_open_water(
            values,
            np.ones(values.shape, dtype=bool),
            units="linear",
            threshold_db=-12.0,
            minimum_mapping_unit_ha=1.0,
        )


def test_minimum_mapping_unit_removes_small_components() -> None:
    values = np.full((10, 10), 0.3, dtype=float)
    values[1:3, 1:3] = 0.01
    values[6:10, 6:10] = 0.01
    mask = classify_open_water(
        values,
        np.ones(values.shape, dtype=bool),
        units="linear",
        threshold_db=-12.0,
        minimum_mapping_unit_ha=0.05,
        pixel_area_m2=100.0,
    )
    assert int(mask.sum()) == 16


def test_lee_filter_is_nodata_safe() -> None:
    power = np.full((7, 7), 0.1, dtype=float)
    valid = np.ones(power.shape, dtype=bool)
    valid[0, :] = False
    filtered = lee_filter_power(power, valid, size=3, enl=4.0)

    assert np.isnan(filtered[0, :]).all()
    assert np.isfinite(filtered[3, 3])


def test_exclusion_masks_remove_support_without_creating_land() -> None:
    valid = np.ones((3, 3), dtype=bool)
    excluded = np.zeros((3, 3), dtype=bool)
    excluded[1, 1] = True
    result, counts = apply_exclusion_masks(valid, excluded)

    assert not result[1, 1]
    assert int(result.sum()) == 8
    assert counts["exclusion_0"] == 1
    assert counts["valid_after_exclusions"] == 8


def test_exclusion_mask_shape_mismatch_fails_closed() -> None:
    with pytest.raises(ValueError, match="identical|shape"):
        apply_exclusion_masks(np.ones((2, 2), dtype=bool), np.ones((3, 3), dtype=bool))
