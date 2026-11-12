"""Reproducible validation helpers for the NISAR science readers."""

from .injection import gaussian_patch, fault_scarp_step, project_downslope
from .surrogates import phase_randomized_surrogate
from .gls_persistence import evaluate_cluster_persistence, fit_gls_rate
from .stable_datum import apply_ensemble_datum, compute_hclv_support_mask

__all__ = [
    "fault_scarp_step",
    "gaussian_patch",
    "phase_randomized_surrogate",
    "project_downslope",
    "evaluate_cluster_persistence",
    "fit_gls_rate",
    "apply_ensemble_datum",
    "compute_hclv_support_mask",
]
