from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy import ndimage


@dataclass(frozen=True)
class OtsuDiagnostics:
    """Diagnostics for an exploratory global Otsu threshold.

    Separability is a screening diagnostic, not a classifier accuracy score.
    """

    threshold_db: float
    separability: float | None
    minority_fraction: float | None
    valid_count: int
    reliable: bool
    reasons: tuple[str, ...]

    def as_dict(self) -> dict[str, object]:
        return {
            "threshold_db": self.threshold_db,
            "separability": self.separability,
            "minority_fraction": self.minority_fraction,
            "valid_count": self.valid_count,
            "reliable": self.reliable,
            "reasons": list(self.reasons),
            "interpretation": "Exploratory threshold diagnostics; not independent accuracy validation.",
        }


def otsu_threshold_db(values_db: np.ndarray, valid: np.ndarray, bins: int = 512) -> float:
    """Estimate one global Otsu threshold in dB from all selected dates."""
    values = np.asarray(values_db, dtype=np.float64)[np.asarray(valid, dtype=bool)]
    values = values[np.isfinite(values)]
    if values.size < 100:
        raise ValueError("At least 100 valid pixels are required for Otsu threshold estimation.")

    low, high = np.percentile(values, [1.0, 99.0])
    if not np.isfinite(low + high) or high <= low:
        raise ValueError("Backscatter distribution has insufficient variation for Otsu.")
    histogram, edges = np.histogram(values, bins=bins, range=(low, high))
    centers = (edges[:-1] + edges[1:]) / 2.0

    weight_left = np.cumsum(histogram, dtype=np.float64)
    weighted_left = np.cumsum(histogram * centers, dtype=np.float64)
    total = weight_left[-1]
    total_weighted = weighted_left[-1]
    weight_right = total - weight_left
    valid_split = (weight_left > 0) & (weight_right > 0)

    between = np.full(histogram.shape, -np.inf, dtype=np.float64)
    numerator = (total_weighted * weight_left - weighted_left * total) ** 2
    between[valid_split] = numerator[valid_split] / (
        weight_left[valid_split] * weight_right[valid_split]
    )
    best = int(np.argmax(between))
    threshold = float(centers[best])
    if not np.isfinite(threshold):
        raise ValueError("Could not estimate a finite Otsu threshold.")
    return threshold


def otsu_threshold_diagnostics(
    values_db: np.ndarray,
    valid: np.ndarray,
    *,
    bins: int = 512,
    minimum_separability: float = 0.05,
    minority_fraction_range: tuple[float, float] = (0.005, 0.995),
) -> OtsuDiagnostics:
    """Return reliability diagnostics without claiming geophysical validity.

    The reliability gate only detects obviously weak histogram support. It does
    not prove that low backscatter is water, so callers must retain PROVISIONAL
    status until an independent reference comparison is available.
    """
    values = np.asarray(values_db, dtype=np.float64)[np.asarray(valid, dtype=bool)]
    values = values[np.isfinite(values)]
    threshold = otsu_threshold_db(values, np.ones(values.shape, dtype=bool), bins=bins)
    if values.size == 0:
        return OtsuDiagnostics(threshold, None, None, 0, False, ("NO_VALID_VALUES",))

    low, high = np.percentile(values, [1.0, 99.0])
    histogram, edges = np.histogram(values, bins=bins, range=(low, high))
    centers = (edges[:-1] + edges[1:]) / 2.0
    total = float(histogram.sum())
    weights = histogram.astype(np.float64) / total if total else histogram.astype(np.float64)
    left = float(weights[centers <= threshold].sum())
    minority = min(left, 1.0 - left)
    between = np.zeros(histogram.shape, dtype=np.float64)
    cumulative = np.cumsum(weights)
    means = np.cumsum(weights * centers)
    overall = means[-1]
    valid_split = (cumulative > 0) & (cumulative < 1)
    between[valid_split] = (
        (overall * cumulative[valid_split] - means[valid_split]) ** 2
        / (cumulative[valid_split] * (1.0 - cumulative[valid_split]))
    )
    total_variance = float(np.sum(weights * (centers - overall) ** 2))
    separability = float(np.max(between) / total_variance) if total_variance > 0 else None
    reasons: list[str] = []
    if separability is None or separability < minimum_separability:
        reasons.append("LOW_HISTOGRAM_SEPARABILITY")
    if not (minority_fraction_range[0] <= minority <= minority_fraction_range[1]):
        reasons.append("EXTREME_CLASS_IMBALANCE")
    return OtsuDiagnostics(
        threshold_db=threshold,
        separability=separability,
        minority_fraction=minority,
        valid_count=int(values.size),
        reliable=not reasons,
        reasons=tuple(reasons),
    )


def remove_small_components(mask: np.ndarray, valid: np.ndarray, minimum_pixels: int) -> np.ndarray:
    """Remove connected components smaller than the requested pixel count."""
    result = np.asarray(mask, dtype=bool) & np.asarray(valid, dtype=bool)
    if minimum_pixels <= 1 or not result.any():
        return result

    labels, count = ndimage.label(result, structure=np.ones((3, 3), dtype=np.uint8))
    if count == 0:
        return result
    sizes = np.bincount(labels.ravel())
    keep = sizes >= int(minimum_pixels)
    keep[0] = False
    return keep[labels]


def valid_backscatter_mask(
    backscatter: np.ndarray, valid: np.ndarray, *, units: str,
) -> np.ndarray:
    """Identify measurable backscatter samples before area or threshold calculations."""
    array = np.asarray(backscatter, dtype=np.float64)
    support = np.asarray(valid, dtype=bool)
    if array.shape != support.shape:
        raise ValueError("Backscatter raster and validity mask must have identical shapes.")
    if units not in {"linear", "db"}:
        raise ValueError("units must be either 'linear' or 'db'.")
    result = support & np.isfinite(array)
    if units == "linear":
        # Zero/negative power has no finite logarithmic value and must not be
        # counted as observed non-water in an area denominator.
        result &= array > 0
    return result


def classify_open_water(
    backscatter: np.ndarray,
    valid: np.ndarray,
    *,
    units: str,
    threshold_db: float,
    minimum_pixels: int = 1,
    minimum_mapping_unit_ha: float | None = None,
    pixel_area_m2: float | None = None,
) -> np.ndarray:
    """Classify low-backscatter open-water candidates using a declared threshold.

    This is an intensity-screening method, not a universal water classifier.
    Flooded vegetation can produce strong double-bounce returns and may be missed.
    """
    array = np.asarray(backscatter, dtype=np.float64)
    valid_mask = valid_backscatter_mask(array, valid, units=units)
    if not np.isfinite(threshold_db):
        raise ValueError("threshold_db must be finite.")
    if minimum_pixels < 0:
        raise ValueError("minimum_pixels cannot be negative.")
    if minimum_mapping_unit_ha is not None:
        if not np.isfinite(minimum_mapping_unit_ha) or minimum_mapping_unit_ha < 0:
            raise ValueError("minimum_mapping_unit_ha must be finite and non-negative.")
        if minimum_mapping_unit_ha > 0:
            if pixel_area_m2 is None or not np.isfinite(pixel_area_m2) or pixel_area_m2 <= 0:
                raise ValueError("pixel_area_m2 is required for a positive minimum_mapping_unit_ha.")
            minimum_pixels = max(
                minimum_pixels,
                int(np.ceil(minimum_mapping_unit_ha * 10_000.0 / pixel_area_m2)),
            )
    if units == "linear":
        values_db = np.full(array.shape, np.nan, dtype=np.float64)
        values_db[valid_mask] = 10.0 * np.log10(array[valid_mask])
    elif units == "db":
        values_db = array
    else:
        raise ValueError("units must be either 'linear' or 'db'.")

    water = valid_mask & (values_db <= float(threshold_db))
    return remove_small_components(water, valid_mask, minimum_pixels)
