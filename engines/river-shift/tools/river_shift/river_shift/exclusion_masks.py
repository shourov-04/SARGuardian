"""NoData-safe physical exclusion-mask helpers.

Auxiliary mask semantics must be verified against the source product and are
never converted into non-water labels.
"""

from __future__ import annotations

import numpy as np


def apply_exclusion_masks(
    valid: np.ndarray,
    *exclusions: np.ndarray | None,
) -> tuple[np.ndarray, dict[str, int]]:
    """Remove excluded pixels from support and report each mask contribution."""
    support = np.asarray(valid, dtype=bool).copy()
    counts: dict[str, int] = {}
    for index, exclusion in enumerate(exclusions):
        if exclusion is None:
            continue
        mask = np.asarray(exclusion, dtype=bool)
        if mask.shape != support.shape:
            raise ValueError("All exclusion masks must match the valid-mask shape.")
        removed = int(np.count_nonzero(support & mask))
        counts[f"exclusion_{index}"] = removed
        support &= ~mask
    counts["valid_after_exclusions"] = int(np.count_nonzero(support))
    return support, counts
