"""Tamper-evident evidence-bundle verification for RiverShift release review."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from .raster_io import sha256_file


class EvidenceVerificationError(ValueError):
    """Raised when a verification bundle is incomplete or tampered with."""


def verify_evidence_manifest(
    report_path: str | Path,
    manifest_path: str | Path,
) -> dict[str, Any]:
    """Verify a reviewer-supplied evidence manifest against local artifacts.

    Integrity verification is not scientific validation.  The manifest must
    explicitly carry the reviewer decisions; this function never infers
    independence or accuracy from a file hash.
    """
    report_file = Path(report_path).resolve()
    manifest_file = Path(manifest_path).resolve()
    try:
        report = json.loads(report_file.read_text(encoding="utf-8"))
        manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise EvidenceVerificationError("Report and evidence manifest must be readable JSON.") from exc
    if not isinstance(report, dict) or not isinstance(manifest, dict):
        raise EvidenceVerificationError("Report and evidence manifest must be JSON objects.")

    reviewer = manifest.get("reviewer")
    reviewed_at = manifest.get("reviewed_at")
    artifacts = manifest.get("artifacts")
    if not isinstance(reviewer, str) or not reviewer.strip() or not isinstance(reviewed_at, str) or not reviewed_at.strip():
        raise EvidenceVerificationError("Manifest requires reviewer and reviewed_at attestation fields.")
    if not isinstance(artifacts, list) or not artifacts:
        raise EvidenceVerificationError("Manifest requires a non-empty artifacts list.")

    checked: list[dict[str, Any]] = []
    for item in artifacts:
        if not isinstance(item, dict):
            raise EvidenceVerificationError("Each evidence artifact must be an object.")
        relative = item.get("path")
        expected = item.get("sha256")
        role = item.get("role")
        if not isinstance(relative, str) or not relative or not isinstance(role, str) or not role:
            raise EvidenceVerificationError("Each artifact requires path and role.")
        if not isinstance(expected, str) or not re.fullmatch(r"[0-9a-fA-F]{64}", expected):
            raise EvidenceVerificationError(f"Invalid SHA-256 for evidence artifact: {relative}")
        artifact_path = (manifest_file.parent / relative).resolve()
        try:
            artifact_path.relative_to(manifest_file.parent)
        except ValueError as exc:
            raise EvidenceVerificationError("Evidence artifact path escapes the manifest directory.") from exc
        if not artifact_path.is_file():
            raise EvidenceVerificationError(f"Evidence artifact is missing: {relative}")
        actual = sha256_file(artifact_path)
        if actual.lower() != expected.lower():
            raise EvidenceVerificationError(f"Evidence artifact checksum mismatch: {relative}")
        checked.append({"path": relative, "role": role, "sha256": actual})

    decisions = manifest.get("decisions")
    if not isinstance(decisions, dict):
        raise EvidenceVerificationError("Manifest requires explicit decisions.")
    required = (
        "independent_reference",
        "evidence_verified",
        "evidence_integrity_verified",
        "criteria_passed",
        "verified_scope",
    )
    if any(key not in decisions for key in required):
        raise EvidenceVerificationError("Manifest decisions are incomplete.")
    if not all(isinstance(decisions[key], bool) for key in required[:4]):
        raise EvidenceVerificationError("Manifest decision flags must be boolean.")
    if not isinstance(decisions["verified_scope"], str) or not decisions["verified_scope"].strip():
        raise EvidenceVerificationError("Manifest verified_scope must be non-empty text.")
    if decisions["evidence_integrity_verified"] is not True:
        raise EvidenceVerificationError("Evidence integrity decision must be true after checksum verification.")

    return {
        "independent_reference": decisions["independent_reference"],
        "evidence_verified": decisions["evidence_verified"],
        "evidence_integrity_verified": True,
        "criteria_passed": decisions["criteria_passed"],
        "verified_scope": decisions["verified_scope"],
        "reviewer": reviewer,
        "reviewed_at": reviewed_at,
        "artifacts": checked,
        "status": "EVIDENCE_INTEGRITY_VERIFIED_REVIEW_ATTESTED",
        "scientific_validation_not_inferred": True,
    }
