import numpy as np

from validation.injection import fault_scarp_step, gaussian_patch, project_downslope


def test_gaussian_rotation_preserves_peak_and_energy() -> None:
    first = gaussian_patch((41, 41), 0.1, (400, 800), angle=0)
    second = gaussian_patch((41, 41), 0.1, (400, 800), angle=np.pi / 2)
    assert np.isclose(first.max(), second.max())
    assert np.isclose(np.sum(first), np.sum(second), rtol=0.02)


def test_fault_step_has_bounded_transition() -> None:
    result = fault_scarp_step((32, 32), 1.0, width=2.0)
    assert result.min() >= 0
    assert result.max() <= 1
    assert np.count_nonzero((result > 0.1) & (result < 0.9)) > 0


def test_downslope_projection_keeps_families_separate() -> None:
    assert project_downslope((1, 0, 0), look_vector=(1, 0, 0)) == 1
    assert project_downslope((1, 1, 0), range_vector=(1, 0, 0), azimuth_vector=(0, 1, 0)) == (1, 1)
