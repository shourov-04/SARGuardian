"""Generalized Least Squares temporal persistence and rate testing."""
from __future__ import annotations

from typing import Any

import numpy as np


def fit_gls_rate(
    elapsed_days: np.ndarray,
    displacements: np.ndarray,
    covariance: np.ndarray,
) -> tuple[float, float, float, float]:
    """Fit ``d = v * elapsed_days + e`` with a known SPD covariance matrix."""
    times = np.asarray(elapsed_days, dtype=float)
    values = np.asarray(displacements, dtype=float)
    sigma = np.asarray(covariance, dtype=float)
    if times.ndim != 1 or values.shape != times.shape or sigma.shape != (len(times), len(times)):
        raise ValueError("WITHHELD_INVALID_GLS_SHAPES")
    if len(times) < 3 or not np.all(np.isfinite(times)) or not np.all(np.isfinite(values)):
        raise ValueError("WITHHELD_INSUFFICIENT_PERSISTENCE_SUPPORT")
    if not np.allclose(sigma, sigma.T, rtol=0, atol=1e-12) or not np.all(np.isfinite(sigma)):
        raise ValueError("WITHHELD_NON_SPD_COVARIANCE")
    try:
        chol = np.linalg.cholesky(sigma)
    except np.linalg.LinAlgError as exc:
        raise ValueError("WITHHELD_NON_SPD_COVARIANCE") from exc
    design = times[:, None]
    whitened_design = np.linalg.solve(chol, design)
    whitened_values = np.linalg.solve(chol, values)
    information = float((whitened_design.T @ whitened_design).item())
    if not np.isfinite(information) or information <= 0:
        raise ValueError("WITHHELD_SINGULAR_GLS_DESIGN")
    variance = 1.0 / information
    velocity = float(variance * (whitened_design.T @ whitened_values).item())
    standard_error = float(np.sqrt(variance))
    z_score = float(abs(velocity) / standard_error) if standard_error > 0 else float("inf")
    residuals = values - times * velocity
    chi2 = float(np.linalg.solve(chol, residuals) @ np.linalg.solve(chol, residuals))
    return velocity, standard_error, z_score, chi2 / (len(times) - 1)


def evaluate_cluster_persistence(
    elapsed_days: np.ndarray,
    displacements: np.ndarray,
    covariance: np.ndarray,
    *,
    minimum_wald_z: float = 3.0,
    maximum_reduced_chi2: float = 3.84,
) -> dict[str, Any]:
    """Return a fail-closed kinematic persistence decision and diagnostics."""
    try:
        velocity, standard_error, z_score, reduced_chi2 = fit_gls_rate(elapsed_days, displacements, covariance)
    except ValueError as exc:
        return {"status": str(exc), "velocity_mm_yr": None, "velocity_std_err_mm_yr": None, "z_score": None, "chi2_reduced": None}
    persistent = z_score >= minimum_wald_z and reduced_chi2 <= maximum_reduced_chi2
    scale = 365.25 * 1000.0
    return {
        "status": "PERSISTENT_KINEMATIC" if persistent else "IRREGULAR_NON_KINEMATIC",
        "velocity_mm_yr": velocity * scale,
        "velocity_std_err_mm_yr": standard_error * scale,
        "z_score": z_score,
        "chi2_reduced": reduced_chi2,
    }
