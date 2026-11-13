"""Canonical RiverShift candidate classes and one-release compatibility aliases."""

from __future__ import annotations

NEW_WATER_CANDIDATE = "new_water_candidate"
PERSISTENT_LAND_TO_WATER_TRANSITION_CANDIDATE = "persistent_land_to_water_transition_candidate"
PERSISTENT_WATER_TO_LAND_TRANSITION_CANDIDATE = "persistent_water_to_land_transition_candidate"

CLASS_REGISTRY = {
    NEW_WATER_CANDIDATE: {"deprecated": False},
    PERSISTENT_LAND_TO_WATER_TRANSITION_CANDIDATE: {"deprecated": False},
    PERSISTENT_WATER_TO_LAND_TRANSITION_CANDIDATE: {"deprecated": False},
    "erosion": {"canonical_id": PERSISTENT_LAND_TO_WATER_TRANSITION_CANDIDATE, "deprecated": True},
    "erosion_candidate": {"canonical_id": PERSISTENT_LAND_TO_WATER_TRANSITION_CANDIDATE, "deprecated": True},
    "deposition": {"canonical_id": PERSISTENT_WATER_TO_LAND_TRANSITION_CANDIDATE, "deprecated": True},
    "deposition_candidate": {"canonical_id": PERSISTENT_WATER_TO_LAND_TRANSITION_CANDIDATE, "deprecated": True},
    "new_water": {"canonical_id": NEW_WATER_CANDIDATE, "deprecated": True},
    "newly_water_covered": {"canonical_id": NEW_WATER_CANDIDATE, "deprecated": True},
}


def canonical_class_id(class_id: str) -> str:
    """Resolve a class ID; legacy aliases remain readable for one release."""
    entry = CLASS_REGISTRY.get(class_id)
    if entry is None:
        raise ValueError(f"Unknown RiverShift class ID: {class_id}")
    return entry.get("canonical_id", class_id)


def class_registry() -> dict[str, dict[str, object]]:
    return {key: dict(value) for key, value in CLASS_REGISTRY.items()}
