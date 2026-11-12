"""Cryptographic, audit-ready scientific validation receipt for SARGuardian AOI runs."""
from __future__ import annotations

import hashlib
import json
import re
from typing import Any


def _number(summary: dict[str, Any], *keys: str, default: float = float("nan")) -> float:
    for key in keys:
        value = summary.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return float(value)
    return default


def generate_validation_receipt(
    *,
    aoi_name: str,
    froc_summary: dict[str, Any],
    hclv_summary: dict[str, Any],
    gls_summary: dict[str, Any],
    gnss_summary: dict[str, Any] | None = None,
    provenance_sha256: dict[str, str],
) -> dict[str, Any]:
    """Produce a deterministic validation manifest with a self-integrity hash."""
    if not aoi_name.strip() or not isinstance(provenance_sha256, dict):
        raise ValueError("aoi_name and provenance_sha256 are required")
    if any(not isinstance(key, str) or not isinstance(value, str) or not re.fullmatch(r"[0-9a-fA-F]{64}", value) for key, value in provenance_sha256.items()):
        raise ValueError("provenance_sha256 must map names to SHA-256 hex strings")
    froc_passed = _number(froc_summary, "false_alarm_rate_per_1000_km2", "false_alarm_rate", default=float("inf")) <= 15.0
    limits = froc_summary.get("detection_limits") if isinstance(froc_summary.get("detection_limits"), dict) else {}
    froc_passed = froc_passed and any(froc_summary.get(key) is not None or limits.get(key) is not None for key in ("A90", "a90", "a90_detection_limit"))
    hclv_passed = hclv_summary.get("status") == "HCLV_ENSEMBLE_APPLIED"
    gls_passed = _number(gls_summary, "wald_z", "z_score", "min_wald_z", default=float("nan")) >= 3.0 and _number(gls_summary, "reduced_chi2", "chi2_reduced", "max_reduced_chi2", default=float("nan")) <= 3.84
    gnss_passed = gnss_summary is None or (_number(gnss_summary, "rmse_mm", default=float("inf")) <= 15.0 and _number(gnss_summary, "pearson_r", default=float("nan")) >= 0.75)
    checks = {"froc": froc_passed, "hclv": hclv_passed, "gls": gls_passed, "gnss": gnss_passed}
    receipt: dict[str, Any] = {
        "schema": "SARGuardian/validation-receipt/v1",
        "aoi_name": aoi_name,
        "status": "OPERATIONAL_VALIDATION_PASSED" if all(checks.values()) else "PROVISIONAL_NEEDS_CALIBRATION",
        "checks": checks,
        "froc_summary": froc_summary,
        "hclv_summary": hclv_summary,
        "gls_summary": gls_summary,
        "gnss_summary": gnss_summary,
        "provenance_sha256": dict(sorted(provenance_sha256.items())),
    }
    canonical = json.dumps(receipt, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    receipt["integrity_sha256"] = hashlib.sha256(canonical).hexdigest()
    return receipt
