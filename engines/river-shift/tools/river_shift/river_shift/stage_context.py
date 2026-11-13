"""Hydrological stage context for RiverShift observation interpretation.

This module does not infer discharge, flood peak, or bank response from SAR.
It only joins a caller-supplied dated gauge/stage table to acquisitions and
reports whether the temporal context is available and comparable.
"""
from __future__ import annotations

import csv
import json
from datetime import date
from pathlib import Path
from typing import Any

import numpy as np


class StageContextError(ValueError):
    """Raised when a stage context file is not reproducible or is malformed."""


def load_stage_context(
    path: str | Path,
    observation_dates: dict[str, str],
    *,
    maximum_offset_days: int = 3,
    comparable_range: float | None = None,
) -> dict[str, Any]:
    """Join dated stage observations to SAR dates without interpolation.

    CSV requires ``date`` and ``stage`` columns. JSON may contain either a list
    of ``{"date": ..., "stage": ...}`` rows or ``{"observations": [...]}``.
    Each acquisition uses the nearest observed stage on or around its date; no
    missing value is filled or forecast.
    """
    if maximum_offset_days < 0:
        raise StageContextError("maximum_offset_days cannot be negative.")
    source = Path(path)
    try:
        if source.suffix.lower() == ".json":
            payload = json.loads(source.read_text(encoding="utf-8"))
            rows = payload.get("observations") if isinstance(payload, dict) else payload
        else:
            with source.open("r", newline="", encoding="utf-8") as stream:
                rows = list(csv.DictReader(stream))
    except (OSError, json.JSONDecodeError, UnicodeError) as exc:
        raise StageContextError(f"Cannot read stage context: {source}") from exc
    if not isinstance(rows, list) or not rows:
        raise StageContextError("Stage context must contain a non-empty observation list.")

    observations: list[tuple[date, float]] = []
    for row in rows:
        if not isinstance(row, dict) or "date" not in row or "stage" not in row:
            raise StageContextError("Every stage row requires date and stage fields.")
        try:
            observed_date = date.fromisoformat(str(row["date"]))
            stage = float(row["stage"])
        except (TypeError, ValueError) as exc:
            raise StageContextError("Stage date must be ISO YYYY-MM-DD and stage numeric.") from exc
        if not np.isfinite(stage):
            raise StageContextError("Stage values must be finite.")
        observations.append((observed_date, stage))
    observations.sort(key=lambda item: item[0])

    joined: dict[str, Any] = {}
    matched_stages: list[float] = []
    for role, raw_date in observation_dates.items():
        target = date.fromisoformat(raw_date)
        nearest_date, nearest_stage = min(observations, key=lambda item: abs(item[0] - target))
        offset = abs((nearest_date - target).days)
        match = {
            "acquisition_date": target.isoformat(),
            "stage_date": nearest_date.isoformat(),
            "stage": nearest_stage,
            "offset_days": offset,
            "status": "MATCHED" if offset <= maximum_offset_days else "NO_CLOSE_STAGE_OBSERVATION",
        }
        if offset <= maximum_offset_days:
            matched_stages.append(nearest_stage)
        joined[role] = match

    range_value = max(matched_stages) - min(matched_stages) if matched_stages else None
    comparable = None
    if comparable_range is not None:
        if not np.isfinite(comparable_range) or comparable_range < 0:
            raise StageContextError("comparable_range must be finite and non-negative.")
        comparable = len(matched_stages) == len(observation_dates) and range_value is not None and range_value <= comparable_range

    return {
        "source": str(source),
        "source_sha256": _sha256(source),
        "maximum_offset_days": maximum_offset_days,
        "observations": joined,
        "matched_stage_range": range_value,
        "comparable_within_declared_range": comparable,
        "interpretation": "Observed gauge/stage context only; no discharge conversion, interpolation or flood-peak claim.",
    }


def _sha256(path: Path) -> str:
    import hashlib

    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()
