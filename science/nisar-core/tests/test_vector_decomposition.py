import numpy as np
import pytest

from validation.vector_decomposition import decompose_2d_vectors


def _project(east, up, inc, heading):
    theta, alpha = np.radians(inc), np.radians(heading)
    return -np.sin(theta) * np.cos(alpha) * east + np.cos(theta) * up


def test_pure_subsidence_is_inverted():
    asc = _project(0, -0.02, 35, -12)
    desc = _project(0, -0.02, 35, 192)
    east, up, _, _ = decompose_2d_vectors(np.array([asc]), np.array([desc]), inc_asc_deg=35, heading_asc_deg=-12, inc_desc_deg=35, heading_desc_deg=192)
    assert np.allclose(east, 0)
    assert np.allclose(up, -0.02)


def test_pure_eastward_drift_is_inverted():
    asc = _project(0.03, 0, 35, -12)
    desc = _project(0.03, 0, 35, 192)
    east, up, _, _ = decompose_2d_vectors(np.array([asc]), np.array([desc]), inc_asc_deg=35, heading_asc_deg=-12, inc_desc_deg=35, heading_desc_deg=192)
    assert np.allclose(east, 0.03)
    assert np.allclose(up, 0)


def test_parallel_geometry_is_withheld():
    with pytest.raises(ValueError, match="WITHHELD_POOR_GEOMETRIC_DIVERSITY"):
        decompose_2d_vectors(np.zeros(1), np.zeros(1), inc_asc_deg=35, heading_asc_deg=-12, inc_desc_deg=35, heading_desc_deg=-12)
