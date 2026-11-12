"""Empirical ground-truth validation against continuous 3-D GNSS time series."""
from __future__ import annotations

from typing import Any

import numpy as np


def project_gnss_to_los(
    east_m: np.ndarray,
    north_m: np.ndarray,
    up_m: np.ndarray,
    *,
    incidence_angle_deg: float,
    heading_deg: float,
) -> np.ndarray:
    """Project 3-D GNSS displacement vectors into radar line-of-sight metres."""
    east, north, up = (np.asarray(value, dtype=float) for value in (east_m, north_m, up_m))
    if east.ndim != 1 or north.shape != east.shape or up.shape != east.shape:
        raise ValueError("GNSS displacement arrays must be one-dimensional and equally shaped")
    if not np.isfinite(incidence_angle_deg) or not np.isfinite(heading_deg):
        raise ValueError("GNSS geometry angles must be finite")
    if not all(np.all(np.isfinite(value)) for value in (east, north, up)):
        raise ValueError("GNSS displacement arrays must contain finite values")
    theta = np.radians(float(incidence_angle_deg))
    alpha = np.radians(float(heading_deg))
    s_e = -np.sin(theta) * np.cos(alpha)
    s_n = np.sin(theta) * np.sin(alpha)
    s_u = np.cos(theta)
    return s_e * east + s_n * north + s_u * up


def evaluate_gnss_agreement(
    insar_pairs_displacement_m: np.ndarray,
    insar_pairs_variance_m2: np.ndarray,
    gnss_incremental_los_m: np.ndarray,
    gnss_variance_m2: np.ndarray,
) -> dict[str, Any]:
    """Compare pairwise GUNW LOS displacement with incremental GNSS LOS values."""
    insar, insar_var, gnss, gnss_var = (
        np.asarray(value, dtype=float)
        for value in (
            insar_pairs_displacement_m,
            insar_pairs_variance_m2,
            gnss_incremental_los_m,
            gnss_variance_m2,
        )
    )
    arrays = (insar, insar_var, gnss, gnss_var)
    if any(value.ndim != 1 for value in arrays) or len({value.shape for value in arrays}) != 1:
        raise ValueError("InSAR and GNSS arrays must be one-dimensional and equally shaped")
    if np.any(~np.isfinite(insar)) or np.any(~np.isfinite(gnss)):
        raise ValueError("InSAR and GNSS displacement arrays must be finite")
    if np.any(~np.isfinite(insar_var)) or np.any(~np.isfinite(gnss_var)) or np.any(insar_var < 0) or np.any(gnss_var < 0):
        raise ValueError("InSAR and GNSS variances must be finite and non-negative")

    sample_count = int(insar.size)
    result: dict[str, Any] = {
        "status": "VALIDATION_SUCCESS" if sample_count >= 3 else "WITHHELD_INSUFFICIENT_PAIRS",
        "sample_count": sample_count,
        "rmse_mm": float("nan"),
        "mae_mm": float("nan"),
        "pearson_r": float("nan"),
        "mean_bias_mm": float("nan"),
        "reduced_chi2": float("nan"),
        "agreement_passed": False,
    }
    if sample_count < 3:
        return result

    residual = insar - gnss
    residual_mm = residual * 1000.0
    result["rmse_mm"] = float(np.sqrt(np.mean(residual_mm**2)))
    result["mae_mm"] = float(np.mean(np.abs(residual_mm)))
    result["mean_bias_mm"] = float(np.mean(residual_mm))
    if np.std(insar) == 0 or np.std(gnss) == 0:
        result["pearson_r"] = 1.0 if np.array_equal(insar, gnss) else 0.0
    else:
        result["pearson_r"] = float(np.corrcoef(insar, gnss)[0, 1])
    combined_variance = insar_var + gnss_var
    if np.any(combined_variance <= 0):
        raise ValueError("At least one combined InSAR/GNSS variance must be positive")
    result["reduced_chi2"] = float(np.sum(residual**2 / combined_variance) / (sample_count - 1))
    result["agreement_passed"] = bool(result["rmse_mm"] <= 12.0 and result["pearson_r"] >= 0.75)
    return result
