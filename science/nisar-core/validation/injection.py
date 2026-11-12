"""Synthetic, physically bounded displacement injections.

The functions here operate on arrays and do not know about product discovery or
QC. Callers should add the returned signal to raw product arrays before running
the normal reader pipeline. GOFF and GUNW limits are deliberately separate.
"""
from __future__ import annotations

from math import cos, erf, pi, sin, sqrt
from typing import Literal

import numpy as np


def project_downslope(
    downslope: np.ndarray | tuple[float, float, float],
    *,
    look_vector: np.ndarray | tuple[float, float, float] | None = None,
    range_vector: np.ndarray | tuple[float, float, float] | None = None,
    azimuth_vector: np.ndarray | tuple[float, float, float] | None = None,
) -> float | tuple[float, float]:
    """Project a 3-D downslope vector onto GUNW or GOFF geometry.

    Exactly one geometry family is required: ``look_vector`` returns LOS
    displacement; ``range_vector`` and ``azimuth_vector`` return GOFF
    components. Vectors are normalized so the result is a physical projection.
    """
    u = np.asarray(downslope, dtype=float)
    if u.shape != (3,) or not np.all(np.isfinite(u)):
        raise ValueError("downslope must be a finite 3-vector")
    if look_vector is not None and range_vector is None and azimuth_vector is None:
        ell = np.asarray(look_vector, dtype=float)
        if ell.shape != (3,) or not np.all(np.isfinite(ell)) or np.linalg.norm(ell) == 0:
            raise ValueError("look_vector must be a non-zero finite 3-vector")
        return float(np.dot(u, ell / np.linalg.norm(ell)))
    if look_vector is None and range_vector is not None and azimuth_vector is not None:
        er, ea = np.asarray(range_vector, dtype=float), np.asarray(azimuth_vector, dtype=float)
        if any(v.shape != (3,) or not np.all(np.isfinite(v)) or np.linalg.norm(v) == 0 for v in (er, ea)):
            raise ValueError("GOFF geometry vectors must be non-zero finite 3-vectors")
        return float(np.dot(u, er / np.linalg.norm(er))), float(np.dot(u, ea / np.linalg.norm(ea)))
    raise ValueError("provide either look_vector or both range_vector and azimuth_vector")


def _grid(shape: tuple[int, int], center: tuple[float, float] | None) -> tuple[np.ndarray, np.ndarray]:
    if len(shape) != 2 or any(int(v) < 1 for v in shape):
        raise ValueError("shape must contain two positive dimensions")
    cy, cx = ((shape[0] - 1) / 2, (shape[1] - 1) / 2) if center is None else center
    y, x = np.indices(shape, dtype=float)
    return x - float(cx), y - float(cy)


def gaussian_patch(
    shape: tuple[int, int], amplitude: float, sigma: float | tuple[float, float],
    *, angle: float = 0.0, center: tuple[float, float] | None = None,
    pixel_size: float = 1.0,
) -> np.ndarray:
    """Return a rotated anisotropic Gaussian displacement patch."""
    if not np.isfinite(amplitude) or amplitude == 0 or pixel_size <= 0:
        raise ValueError("amplitude must be finite and pixel_size must be positive")
    sx, sy = (float(sigma), float(sigma)) if np.isscalar(sigma) else map(float, sigma)
    if not np.isfinite(sx) or not np.isfinite(sy) or sx <= 0 or sy <= 0:
        raise ValueError("sigma values must be finite and positive")
    x, y = _grid(shape, center)
    x *= pixel_size
    y *= pixel_size
    c, s = cos(angle), sin(angle)
    xr, yr = c * x + s * y, -s * x + c * y
    return float(amplitude) * np.exp(-0.5 * ((xr / sx) ** 2 + (yr / sy) ** 2))


def fault_scarp_step(
    shape: tuple[int, int], amplitude: float, *, angle: float = 0.0,
    width: float = 2.0, center: tuple[float, float] | None = None,
    pixel_size: float = 1.0,
) -> np.ndarray:
    """Return a smoothed fault/scarp step with a minimum two-pixel boundary."""
    if width < 2 * pixel_size or not np.isfinite(width) or pixel_size <= 0:
        raise ValueError("fault boundary width must be at least two pixels")
    x, y = _grid(shape, center)
    c, s = cos(angle), sin(angle)
    normal = (c * x + s * y) * pixel_size
    return float(amplitude) * 0.5 * (1.0 + np.vectorize(erf)(normal / (sqrt(2.0) * width)))


def validate_injection_limits(family: Literal["GUNW", "GOFF"], amplitude: float, sigma: float, *, pixel_size: float = 80.0) -> None:
    """Fail closed when an injection violates the phase/offset test envelope."""
    if not np.isfinite(amplitude) or not np.isfinite(sigma) or amplitude <= 0 or sigma <= 0:
        raise ValueError("amplitude and sigma must be positive finite values")
    if family == "GUNW":
        if not 0.002 <= amplitude <= 0.1 or sigma < 500 or amplitude / sigma >= 0.12:
            raise ValueError("GUNW injection is outside the 2-100 mm, sigma>=500 m envelope")
        if amplitude / max(sigma / pixel_size, 1.0) >= 0.06:
            raise ValueError("GUNW injection exceeds the approximately lambda/4 per-pixel gradient limit")
    elif family == "GOFF":
        if not 0.1 <= amplitude <= 5.0 or sigma < 240:
            raise ValueError("GOFF injection is outside the 0.1-5 m, sigma>=240 m envelope")
    else:
        raise ValueError("family must be GUNW or GOFF")


def inject_signal(raster: np.ndarray, signal: np.ndarray) -> np.ndarray:
    """Add a finite synthetic signal to a raw raster without modifying input."""
    base, add = np.asarray(raster, dtype=float), np.asarray(signal, dtype=float)
    if base.shape != add.shape or not np.all(np.isfinite(add)):
        raise ValueError("raster and signal must have equal shape; signal must be finite")
    return base + add
