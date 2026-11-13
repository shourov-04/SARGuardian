import json

import numpy as np

from river_shift.calibration import (
    check_profile_applicability,
    fit_reference_threshold,
    load_calibration_profile,
)


def test_reference_threshold_is_marked_calibration_only():
    result = fit_reference_threshold(
        np.array([-20.0, -18.0, -5.0, -3.0]),
        np.array([True, True, False, False]),
    )
    assert result["threshold_db"] == -18.0
    assert result["not_validation"] is True


def test_profile_is_pinned_and_fails_closed_on_metadata_mismatch(tmp_path):
    path = tmp_path / "profile.json"
    path.write_text(json.dumps({
        "profile_id": "test-v1",
        "threshold_db": -17.5,
        "metadata": {"frequency": "frequencyA", "term": "HHHH"},
    }), encoding="utf-8")
    profile = load_calibration_profile(path)
    assert profile.sha256
    assert check_profile_applicability(profile, {"frequency": "frequencyA", "term": "VVVV"})["applicable"] is False
