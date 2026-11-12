import numpy as np

from validation.gnss_benchmark import evaluate_gnss_agreement, project_gnss_to_los


def test_vertical_motion_projects_by_cosine_of_incidence():
    result = project_gnss_to_los(np.zeros(1), np.zeros(1), np.array([0.01]), incidence_angle_deg=35, heading_deg=-12)
    assert np.isclose(result[0], 0.01 * np.cos(np.radians(35)))


def test_noisy_insar_agrees_with_gnss():
    rng = np.random.default_rng(4)
    gnss = np.linspace(-0.02, 0.02, 20)
    insar = gnss + rng.normal(0, 0.001, gnss.size)
    result = evaluate_gnss_agreement(insar, np.full(gnss.size, 1e-6), gnss, np.full(gnss.size, 1e-8))
    assert result["rmse_mm"] < 5
    assert result["pearson_r"] > 0.95
    assert result["agreement_passed"]


def test_insufficient_pairs_withhold_cleanly():
    result = evaluate_gnss_agreement(np.zeros(2), np.ones(2), np.zeros(2), np.ones(2))
    assert result["status"] == "WITHHELD_INSUFFICIENT_PAIRS"
    assert result["agreement_passed"] is False
