import hashlib
import json

import pytest

from river_shift.verification import EvidenceVerificationError, verify_evidence_manifest


def test_evidence_manifest_verifies_hashes_and_explicit_decisions(tmp_path):
    evidence = tmp_path / "reference.txt"
    evidence.write_text("independent reference receipt", encoding="utf-8")
    digest = hashlib.sha256(evidence.read_bytes()).hexdigest()
    report = tmp_path / "report.json"
    report.write_text(json.dumps({"analysis_type": "classification_validation"}), encoding="utf-8")
    manifest = tmp_path / "evidence-manifest.json"
    manifest.write_text(json.dumps({
        "reviewer": "review-board-1",
        "reviewed_at": "2026-11-13T12:00:00Z",
        "artifacts": [{"path": evidence.name, "sha256": digest, "role": "independent_reference"}],
        "decisions": {
            "independent_reference": True,
            "evidence_verified": True,
            "evidence_integrity_verified": True,
            "criteria_passed": True,
            "verified_scope": "water_classification",
        },
    }), encoding="utf-8")
    result = verify_evidence_manifest(report, manifest)
    assert result["evidence_integrity_verified"] is True
    assert result["scientific_validation_not_inferred"] is True


def test_evidence_manifest_rejects_tampering(tmp_path):
    evidence = tmp_path / "reference.txt"
    evidence.write_text("original", encoding="utf-8")
    report = tmp_path / "report.json"
    report.write_text("{}", encoding="utf-8")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({
        "reviewer": "reviewer", "reviewed_at": "2026-11-13",
        "artifacts": [{"path": evidence.name, "sha256": "0" * 64, "role": "reference"}],
        "decisions": {
            "independent_reference": True, "evidence_verified": True,
            "evidence_integrity_verified": True, "criteria_passed": True,
            "verified_scope": "water_classification",
        },
    }), encoding="utf-8")
    with pytest.raises(EvidenceVerificationError, match="checksum mismatch"):
        verify_evidence_manifest(report, manifest)
