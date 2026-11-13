"""Reference-backed threshold calibration helpers.

Calibration is deliberately separate from validation.  A threshold fitted to a
reference raster is not an accuracy result and must not upgrade a RiverShift
release state by itself.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

from .raster_io import sha256_file


class CalibrationProfileError(ValueError):
    """Raised when a calibration profile is malformed or not applicable."""


@dataclass(frozen=True)
class CalibrationProfile:
    profile_id: str
    threshold_db: float
    metadata: dict[str, Any]
    path: str
    sha256: str

    def as_dict(self) -> dict[str, Any]:
        return {
            "profile_id": self.profile_id,
            "threshold_db": self.threshold_db,
            "metadata": self.metadata,
            "path": self.path,
            "sha256": self.sha256,
            "status": "CALIBRATION_ONLY_NOT_VALIDATION",
        }


def load_calibration_profile(path: str | Path) -> CalibrationProfile:
    """Load a pinned JSON profile; never silently fall back to a default."""
    profile_path = Path(path)
    try:
        payload = json.loads(profile_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise CalibrationProfileError(f"Cannot read calibration profile: {profile_path}") from exc
    if not isinstance(payload, dict):
        raise CalibrationProfileError("Calibration profile must be a JSON object.")
    profile_id = payload.get("profile_id")
    threshold = payload.get("threshold_db")
    if not isinstance(profile_id, str) or not profile_id.strip():
        raise CalibrationProfileError("Calibration profile requires a non-empty profile_id.")
    if isinstance(threshold, bool) or not isinstance(threshold, (int, float)) or not np.isfinite(threshold):
        raise CalibrationProfileError("Calibration profile threshold_db must be finite numeric dB.")
    metadata = payload.get("metadata", {})
    if not isinstance(metadata, dict):
        raise CalibrationProfileError("Calibration profile metadata must be an object.")
    return CalibrationProfile(
        profile_id=profile_id,
        threshold_db=float(threshold),
        metadata=metadata,
        path=str(profile_path),
        sha256=sha256_file(profile_path),
    )


def check_profile_applicability(
    profile: CalibrationProfile,
    observed: dict[str, Any],
) -> dict[str, Any]:
    """Compare declared profile metadata with observed metadata, fail closed.

    Only keys explicitly present in the profile are checked.  A missing observed
    value is a mismatch, because applicability cannot be demonstrated.
    """
    reasons: list[str] = []
    for key, expected in profile.metadata.items():
        actual = observed.get(key)
        if actual != expected:
            reasons.append(f"{key}: expected {expected!r}, observed {actual!r}")
    return {
        "applicable": not reasons,
        "status": "APPLICABLE" if not reasons else "NOT_APPLICABLE",
        "reasons": reasons,
        "profile_id": profile.profile_id,
        "profile_sha256": profile.sha256,
    }


def fit_reference_threshold(
    backscatter_db: np.ndarray,
    reference_water: np.ndarray,
    valid: np.ndarray | None = None,
) -> dict[str, Any]:
    """Fit a low-backscatter threshold against supplied reference labels.

    This returns calibration diagnostics only.  It must not be reported as an
    independently validated accuracy score, and it does not write a profile.
    """
    values = np.asarray(backscatter_db, dtype=np.float64)
    labels = np.asarray(reference_water, dtype=bool)
    if values.shape != labels.shape:
        raise CalibrationProfileError("Backscatter and reference arrays must have identical shapes.")
    support = np.ones(values.shape, dtype=bool) if valid is None else np.asarray(valid, dtype=bool)
    if support.shape != values.shape:
        raise CalibrationProfileError("Calibration valid mask must match the input shape.")
    support &= np.isfinite(values)
    if int(support.sum()) < 2 or not labels[support].any() or labels[support].all():
        raise CalibrationProfileError("Calibration requires both water and non-water reference pixels.")

    candidates = np.unique(values[support])
    best: tuple[float, float, float, float] | None = None
    for threshold in candidates:
        predicted = values <= threshold
        tp = float(np.sum(predicted[support] & labels[support]))
        fp = float(np.sum(predicted[support] & ~labels[support]))
        fn = float(np.sum(~predicted[support] & labels[support]))
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / (tp + fn) if tp + fn else 0.0
        f1 = 2.0 * precision * recall / (precision + recall) if precision + recall else 0.0
        iou = tp / (tp + fp + fn) if tp + fp + fn else 0.0
        candidate = (f1, iou, precision, -float(threshold))
        if best is None or candidate > best:
            best = candidate
            best_threshold = float(threshold)
    assert best is not None
    return {
        "threshold_db": best_threshold,
        "calibration_f1": best[0],
        "calibration_iou": best[1],
        "calibration_precision": best[2],
        "valid_pixel_count": int(support.sum()),
        "status": "CALIBRATED_AGAINST_SUPPLIED_REFERENCE",
        "not_validation": True,
    }
