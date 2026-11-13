"""Conservative RiverShift scientific release and claim controls.

Structural/provenance checks are deliberately not treated as scientific validation.
The helpers in this module are pure and require callers to supply independent evidence.
"""

from __future__ import annotations

from typing import Any

PROVISIONAL_SCREENING = "PROVISIONAL_SCREENING"
VALIDATED_WATER_CLASSIFICATION = "VALIDATED_WATER_CLASSIFICATION"
VALIDATED_BANKLINE_CHANGE = "VALIDATED_BANKLINE_CHANGE"
VERIFIED = "VERIFIED"
NO_SCORE = "NO_SCORE"

SCORE_COMPUTED = "SCORE_COMPUTED"
SCORE_STATUS_NO_SCORE = NO_SCORE
CRITERIA_FAILED = "CRITERIA_FAILED"

REASON_CODES = {
    "REFERENCE_NOT_PROVIDED",
    "REFERENCE_NOT_INDEPENDENTLY_VERIFIED",
    "INDEPENDENCE_NOT_VERIFIED",
    "EVIDENCE_MISSING",
    "EVIDENCE_TAMPERED",
    "EVIDENCE_NOT_VERIFIED",
    "CRITERIA_FAILED",
    "NO_COMPARABLE_VALID_PIXELS",
    "METRIC_UNDEFINED",
    "PROVENANCE_PASS_NOT_SCIENTIFIC_VALIDATION",
}

ALLOWED_CLAIMS: dict[str, tuple[str, ...]] = {
    PROVISIONAL_SCREENING: (
        "screening_candidate_map",
        "observed_radar_classification_candidate",
        "structural_and_provenance_status",
    ),
    VALIDATED_WATER_CLASSIFICATION: (
        "validated_water_classification_against_independent_reference",
        "screening_candidate_map",
    ),
    VALIDATED_BANKLINE_CHANGE: (
        "validated_bankline_change_against_independent_reference",
        "screening_candidate_map",
    ),
    VERIFIED: (
        "independently_evidenced_and_integrity_verified_result",
        "validated_water_classification_or_bankline_change",
    ),
    NO_SCORE: (
        "screening_candidate_map_only",
        "no_accuracy_or_validation_score",
    ),
}

EVIDENCE_REQUIREMENTS: dict[str, tuple[str, ...]] = {
    VALIDATED_WATER_CLASSIFICATION: (
        "independent_reference",
        "evidence_verified",
        "criteria_passed",
    ),
    VALIDATED_BANKLINE_CHANGE: (
        "independent_bankline_reference",
        "evidence_verified",
        "criteria_passed",
    ),
    VERIFIED: (
        "independent_reference_or_bankline_reference",
        "evidence_verified",
        "evidence_integrity_verified",
        "criteria_passed",
        "provenance_complete",
    ),
}


def _reasons(*codes: str) -> list[str]:
    return list(dict.fromkeys(code for code in codes if code in REASON_CODES))


def determine_release_status(
    *,
    evidence: dict[str, Any] | None = None,
    score_available: bool = True,
    validation_scope: str = "water_classification",
    criteria_passed: bool | None = None,
    provenance_complete: bool = False,
) -> dict[str, Any]:
    """Return a release decision; missing or unverified evidence fails closed."""
    evidence = evidence or {}
    reasons: list[str] = []
    if not score_available:
        reasons.append("REFERENCE_NOT_PROVIDED")
        status = NO_SCORE
        score_status = SCORE_STATUS_NO_SCORE
    elif criteria_passed is False:
        reasons.append("CRITERIA_FAILED")
        status = PROVISIONAL_SCREENING
        score_status = CRITERIA_FAILED
    else:
        status = PROVISIONAL_SCREENING
        score_status = SCORE_COMPUTED

    independent = bool(evidence.get("independent_reference") or evidence.get("independent_bankline_reference"))
    verified = evidence.get("evidence_verified") is True
    integrity = evidence.get("evidence_integrity_verified") is True
    if not independent:
        reasons.append("REFERENCE_NOT_INDEPENDENTLY_VERIFIED")
        reasons.append("INDEPENDENCE_NOT_VERIFIED")
    if evidence and not verified:
        reasons.append("EVIDENCE_TAMPERED" if evidence.get("tampered") else "EVIDENCE_NOT_VERIFIED")
    if not evidence and score_available:
        reasons.append("EVIDENCE_MISSING")

    if score_available and criteria_passed is True and independent and verified:
        status = VALIDATED_BANKLINE_CHANGE if validation_scope == "bankline_change" else VALIDATED_WATER_CLASSIFICATION
        if status == VALIDATED_BANKLINE_CHANGE and not evidence.get("independent_bankline_reference"):
            status = PROVISIONAL_SCREENING
            reasons.append("REFERENCE_NOT_INDEPENDENTLY_VERIFIED")
        if evidence.get("tampered"):
            status = PROVISIONAL_SCREENING
            reasons.append("EVIDENCE_TAMPERED")
        if status != PROVISIONAL_SCREENING and not integrity:
            reasons.append("EVIDENCE_NOT_VERIFIED")
        if status != PROVISIONAL_SCREENING and evidence.get("verified_scope") == "all" and integrity and provenance_complete:
            status = VERIFIED

    if not reasons and status == PROVISIONAL_SCREENING:
        reasons.append("PROVENANCE_PASS_NOT_SCIENTIFIC_VALIDATION")
    return {
        "release_status": status,
        "score_status": score_status,
        "reasons": _reasons(*reasons),
        "allowed_claims": list(ALLOWED_CLAIMS[status]),
        "validation_evidence_requirements": list(EVIDENCE_REQUIREMENTS.get(status, ())),
    }


def add_release_metadata(
    report: dict[str, Any],
    *,
    score_available: bool = True,
    validation_scope: str = "water_classification",
    evidence: dict[str, Any] | None = None,
    criteria_passed: bool | None = None,
) -> dict[str, Any]:
    """Add canonical top-level fields while retaining legacy quality fields."""
    quality = report.get("quality") if isinstance(report.get("quality"), dict) else {}
    decision = determine_release_status(
        evidence=evidence,
        score_available=score_available,
        validation_scope=validation_scope,
        criteria_passed=criteria_passed,
        provenance_complete=quality.get("provenance_complete") is True,
    )
    report.update(decision)
    report["structural_status"] = quality.get("status")
    # Existing consumers use quality.release_status=PROVISIONAL.
    quality.setdefault("release_status", "PROVISIONAL")
    quality.setdefault("structural_status", quality.get("status"))
    report["quality"] = quality
    return report
