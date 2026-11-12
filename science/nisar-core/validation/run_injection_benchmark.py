"""Run a deterministic synthetic injection-recovery benchmark.

This is intentionally a harness over a supplied detector callback in future
production use. The standalone mode records the known injection ensemble and
is useful for validating the FROC plumbing without claiming detector accuracy.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

try:
    from .froc import evaluate_froc, empirical_detection_limits
    from .injection import gaussian_patch, validate_injection_limits
except ImportError:  # direct ``python validation/run_injection_benchmark.py`` use
    from froc import evaluate_froc, empirical_detection_limits
    from injection import gaussian_patch, validate_injection_limits


def run(trials: int = 100, seed: int = 20261113) -> dict:
    if trials < 1:
        raise ValueError("trials must be positive")
    rng = np.random.default_rng(seed)
    records = []
    amplitudes = (0.1, 0.25, 0.5, 1.0)
    for index in range(trials):
        amplitude = amplitudes[index % len(amplitudes)]
        sigma = 240.0
        validate_injection_limits("GOFF", amplitude, sigma)
        injection = gaussian_patch((64, 64), amplitude, sigma, center=(32, 32), pixel_size=80.0)
        noise = rng.normal(0, 0.03, injection.shape)
        observed = noise + injection
        # Harness baseline: a deliberately transparent amplitude-floor detector.
        detected = bool(np.max(np.abs(observed)) >= max(0.1, amplitude / 2))
        records.append({
            "injections": [{"mask": injection >= amplitude / 2, "amplitude": amplitude, "sigma": sigma, "geometry": "gaussian"}],
            "detections": [{"mask": observed >= amplitude / 2}] if detected else [],
        })
    summary = evaluate_froc(records, area_km2=64 * 64 * 80 * 80 / 1_000_000)
    summary["trials"] = trials
    summary["seed"] = seed
    summary["detection_limits"] = empirical_detection_limits(summary["conditions"])
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--trials", type=int, default=100)
    parser.add_argument("--seed", type=int, default=20261113)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    summary = run(args.trials, args.seed)
    encoded = json.dumps(summary, indent=2, sort_keys=True)
    if args.output:
        args.output.write_text(encoded + "\n", encoding="utf-8")
    print(encoded)
    print(f"A50={summary['detection_limits']['A50']} A90={summary['detection_limits']['A90']}")


if __name__ == "__main__":
    main()
