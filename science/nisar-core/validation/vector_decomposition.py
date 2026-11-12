"""2.5D East-West and Up-Down vector decomposition from Ascending and Descending LOS."""
from __future__ import annotations

from typing import Any

import numpy as np


def _los_coefficients(incidence_deg: float, heading_deg: float) -> tuple[float, float]:
    if not np.isfinite(incidence_deg) or not np.isfinite(heading_deg):
        raise ValueError("look geometry angles must be finite")
    theta, alpha = np.radians(float(incidence_deg)), np.radians(float(heading_deg))
    return float(-np.sin(theta) * np.cos(alpha)), float(np.cos(theta))


def decompose_2d_vectors(
    los_asc_m: np.ndarray,
    los_desc_m: np.ndarray,
    *,
    inc_asc_deg: float,
    heading_asc_deg: float,
    inc_desc_deg: float,
    heading_desc_deg: float,
    var_asc_m2: np.ndarray | float = 1e-4,
    var_desc_m2: np.ndarray | float = 1e-4,
    max_condition_number: float = 10.0,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Invert paired ascending/descending LOS observations into East and Up fields."""
    asc, desc = np.asarray(los_asc_m, dtype=float), np.asarray(los_desc_m, dtype=float)
    if asc.shape != desc.shape:
        raise ValueError("ascending and descending LOS arrays must have equal shapes")
    if asc.ndim == 0:
        asc, desc = asc.reshape(1), desc.reshape(1)
    if not np.isfinite(max_condition_number) or max_condition_number <= 0:
        raise ValueError("max_condition_number must be positive and finite")
    a_e, a_u = _los_coefficients(inc_asc_deg, heading_asc_deg)
    d_e, d_u = _los_coefficients(inc_desc_deg, heading_desc_deg)
    geometry = np.array([[a_e, a_u], [d_e, d_u]], dtype=float)
    condition_number = float(np.linalg.cond(geometry))
    if not np.isfinite(condition_number) or condition_number > max_condition_number:
        raise ValueError("WITHHELD_POOR_GEOMETRIC_DIVERSITY")
    asc_var = np.broadcast_to(np.asarray(var_asc_m2, dtype=float), asc.shape)
    desc_var = np.broadcast_to(np.asarray(var_desc_m2, dtype=float), desc.shape)
    if np.any(~np.isfinite(asc_var)) or np.any(~np.isfinite(desc_var)) or np.any(asc_var <= 0) or np.any(desc_var <= 0):
        raise ValueError("LOS variances must be finite and positive")

    valid = np.isfinite(asc) & np.isfinite(desc)
    flat = np.column_stack((asc.reshape(-1), desc.reshape(-1)))
    weights = np.stack((1.0 / asc_var.reshape(-1), 1.0 / desc_var.reshape(-1)), axis=1)
    east = np.full(asc.size, np.nan, dtype=float)
    up = np.full(asc.size, np.nan, dtype=float)
    east_variance = np.full(asc.size, np.nan, dtype=float)
    up_variance = np.full(asc.size, np.nan, dtype=float)
    valid_flat = valid.reshape(-1)
    for index in np.flatnonzero(valid_flat):
        weighted_normal = geometry.T @ np.diag(weights[index]) @ geometry
        solution = np.linalg.solve(weighted_normal, geometry.T @ (weights[index] * flat[index]))
        east[index], up[index] = solution
        covariance = np.linalg.inv(weighted_normal)
        east_variance[index], up_variance[index] = covariance[0, 0], covariance[1, 1]
    return east.reshape(asc.shape), up.reshape(asc.shape), east_variance.reshape(asc.shape), up_variance.reshape(asc.shape)
