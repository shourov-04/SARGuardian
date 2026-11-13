import numpy as np

from river_shift.classes import (
    NEW_WATER_CANDIDATE,
    PERSISTENT_LAND_TO_WATER_TRANSITION_CANDIDATE,
    canonical_class_id,
)
from river_shift.release_status import (
    CRITERIA_FAILED,
    NO_SCORE,
    PROVISIONAL_SCREENING,
    VERIFIED,
    determine_release_status,
)
from river_shift.validation import validate_binary_classification
from river_shift.validation import _block_confusion_counts


def test_undefined_metrics_are_none_with_reasons(raster_writer):
    prediction = raster_writer("undefined-prediction.tif", np.zeros((2, 2), dtype=np.uint8))
    reference = raster_writer("undefined-reference.tif", np.zeros((2, 2), dtype=np.uint8))
    result = validate_binary_classification(
        str(prediction), str(reference), reference_source="fixture", reference_date="2026-07-01",
        reference_method="synthetic", bootstrap_replicates=100,
    )
    metrics = result["metrics"]
    assert metrics["precision_user_accuracy"] is None
    assert metrics["recall_producer_accuracy"] is None
    assert metrics["f1_score"] is None
    assert metrics["intersection_over_union"] is None
    assert metrics["area_bias_percent"] is None
    assert result["undefined_reasons"]["precision_user_accuracy"] == "NO_PREDICTED_POSITIVES"


def test_nodata_is_excluded_from_confusion_matrix(raster_writer):
    counts = _block_confusion_counts(
        np.array([[1, 255]], dtype=np.uint8),
        np.array([[1, 0]], dtype=np.uint8),
        np.array([[True, False]]),
        64,
    )
    assert counts.tolist() == [[1, 0, 0, 0]]


def test_release_transitions_fail_closed():
    assert determine_release_status(score_available=False)["release_status"] == NO_SCORE
    assert determine_release_status(score_available=True, criteria_passed=False)["score_status"] == CRITERIA_FAILED
    assert determine_release_status(score_available=True, criteria_passed=True)["release_status"] == PROVISIONAL_SCREENING
    verified = determine_release_status(
        score_available=True, criteria_passed=True, provenance_complete=True,
        evidence={
            "independent_reference": True, "evidence_verified": True,
            "evidence_integrity_verified": True, "verified_scope": "all",
        },
    )
    assert verified["release_status"] == VERIFIED
    tampered = determine_release_status(
        score_available=True, criteria_passed=True,
        evidence={"independent_reference": True, "evidence_verified": True, "tampered": True},
    )
    assert tampered["release_status"] != VERIFIED


def test_legacy_class_aliases_are_readable_but_canonicalized():
    assert canonical_class_id("erosion") == PERSISTENT_LAND_TO_WATER_TRANSITION_CANDIDATE
    assert canonical_class_id("newly_water_covered") == NEW_WATER_CANDIDATE


def test_provisional_claims_do_not_include_validation_claim():
    decision = determine_release_status(score_available=True)
    assert decision["release_status"] == PROVISIONAL_SCREENING
    assert "validated_water_classification_against_independent_reference" not in decision["allowed_claims"]
