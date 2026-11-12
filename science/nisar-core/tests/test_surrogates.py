import numpy as np

from validation.surrogates import phase_randomized_surrogate


def test_surrogate_preserves_power_spectrum_and_mean() -> None:
    source = np.arange(64, dtype=float).reshape(8, 8)
    surrogate = phase_randomized_surrogate(source, rng=np.random.default_rng(3))
    np.testing.assert_allclose(np.abs(np.fft.rfftn(source - source.mean())), np.abs(np.fft.rfftn(surrogate - surrogate.mean())), atol=1e-10)
    assert np.isclose(source.mean(), surrogate.mean())
