import hashlib
import json

from validation.validation_receipt import generate_validation_receipt


def _valid(**overrides):
    values = {"aoi_name": "test-aoi", "froc_summary": {"A90": 0.01, "false_alarm_rate_per_1000_km2": 10}, "hclv_summary": {"status": "HCLV_ENSEMBLE_APPLIED"}, "gls_summary": {"wald_z": 4, "reduced_chi2": 1.2}, "provenance_sha256": {"science": "a" * 64}}
    values.update(overrides)
    return values


def test_receipt_passes_and_hashes_canonically():
    receipt = generate_validation_receipt(**_valid(gnss_summary={"rmse_mm": 4, "pearson_r": 0.9}))
    assert receipt["status"] == "OPERATIONAL_VALIDATION_PASSED"
    unsigned = {key: value for key, value in receipt.items() if key != "integrity_sha256"}
    expected = hashlib.sha256(json.dumps(unsigned, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()
    assert receipt["integrity_sha256"] == expected


def test_high_far_or_gnss_error_is_provisional():
    assert generate_validation_receipt(**_valid(froc_summary={"A90": 0.01, "false_alarm_rate_per_1000_km2": 16}))["status"] == "PROVISIONAL_NEEDS_CALIBRATION"
    assert generate_validation_receipt(**_valid(gnss_summary={"rmse_mm": 16, "pearson_r": 0.99}))["status"] == "PROVISIONAL_NEEDS_CALIBRATION"
