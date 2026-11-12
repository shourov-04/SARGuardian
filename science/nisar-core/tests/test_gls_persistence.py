import numpy as np
import pytest

from validation.gls_persistence import evaluate_cluster_persistence, fit_gls_rate


def test_linear_rate_is_persistent() -> None:
    elapsed = np.array([12.0, 24.0, 36.0, 48.0])
    displacement = 10.0 / 365.25 * elapsed / 1000.0
    result = evaluate_cluster_persistence(elapsed, displacement, np.eye(4) * 1e-10)
    assert result["status"] == "PERSISTENT_KINEMATIC"
    assert result["z_score"] > 3
    assert result["chi2_reduced"] < 1e-8


def test_alternating_series_is_not_kinematic() -> None:
    elapsed = np.array([12.0, 24.0, 36.0, 48.0])
    result = evaluate_cluster_persistence(elapsed, np.array([1.0, -1.0, 1.0, -1.0]), np.eye(4))
    assert result["status"] == "IRREGULAR_NON_KINEMATIC"


def test_non_spd_covariance_fails_closed() -> None:
    with pytest.raises(ValueError, match="WITHHELD_NON_SPD_COVARIANCE"):
        fit_gls_rate(np.array([1.0, 2.0, 3.0]), np.ones(3), np.ones((3, 3)))
