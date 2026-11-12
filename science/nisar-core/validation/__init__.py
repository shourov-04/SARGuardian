"""Reproducible validation helpers for the NISAR science readers."""

from .injection import gaussian_patch, fault_scarp_step, project_downslope
from .surrogates import phase_randomized_surrogate

__all__ = [
    "fault_scarp_step",
    "gaussian_patch",
    "phase_randomized_surrogate",
    "project_downslope",
]
