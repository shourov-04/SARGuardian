"""Spatial null surrogates that preserve a raster's exact power spectrum."""
from __future__ import annotations

import numpy as np


def phase_randomized_surrogate(
    raster: np.ndarray, *, rng: np.random.Generator | None = None,
    preserve_mean: bool = True,
) -> np.ndarray:
    """Randomize 2-D Fourier phase while preserving Hermitian symmetry.

    ``rfftn`` stores only the independent half-plane; inverse ``irfftn``
    reconstructs the conjugate half automatically and therefore guarantees a
    real-valued surrogate. The DC component is retained when preserving mean.
    """
    source = np.asarray(raster, dtype=float)
    if source.ndim != 2 or not np.all(np.isfinite(source)):
        raise ValueError("raster must be a finite 2-D array")
    generator = rng or np.random.default_rng()
    mean = float(source.mean())
    centered = source - mean
    spectrum = np.fft.fft2(centered)
    randomized = np.zeros_like(spectrum, dtype=complex)
    rows, cols = source.shape
    for row in range(rows):
        for col in range(cols):
            mirror = ((-row) % rows, (-col) % cols)
            if (row, col) > mirror:
                continue
            magnitude = abs(spectrum[row, col])
            if (row, col) == (0, 0):
                randomized[row, col] = spectrum[row, col]
            elif (row, col) == mirror:
                randomized[row, col] = magnitude * (1 if generator.random() >= 0.5 else -1)
            else:
                phase = generator.uniform(-np.pi, np.pi)
                value = magnitude * np.exp(1j * phase)
                randomized[row, col] = value
                randomized[mirror] = np.conj(value)
    result = np.fft.ifft2(randomized).real
    if preserve_mean:
        result += mean
    return result
