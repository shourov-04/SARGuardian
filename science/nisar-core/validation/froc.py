"""FROC and injection-recovery summaries for spatial candidate clusters."""
from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np


def intersection_over_union(first: np.ndarray, second: np.ndarray) -> float:
    a, b = np.asarray(first, dtype=bool), np.asarray(second, dtype=bool)
    if a.shape != b.shape:
        raise ValueError("masks must have equal shape")
    union = np.count_nonzero(a | b)
    return float(np.count_nonzero(a & b) / union) if union else 0.0


def wilson_interval(successes: int, trials: int, confidence: float = 0.95) -> tuple[float, float]:
    if not 0 <= successes <= trials or trials < 1:
        raise ValueError("successes must be between zero and trials")
    if confidence != 0.95:
        raise ValueError("only the specified 95% Wilson interval is supported")
    z = 1.959963984540054
    p = successes / trials
    denominator = 1 + z * z / trials
    centre = (p + z * z / (2 * trials)) / denominator
    half = z * np.sqrt(p * (1 - p) / trials + z * z / (4 * trials * trials)) / denominator
    return float(max(0, centre - half)), float(min(1, centre + half))


def evaluate_froc(
    trials: list[dict[str, Any]], *, iou_threshold: float = 0.3,
    area_km2: float = 1000.0,
) -> dict[str, Any]:
    """Match each detected mask to at most one injection and summarize FROC."""
    if not 0 < iou_threshold <= 1 or area_km2 <= 0:
        raise ValueError("invalid IoU threshold or area")
    groups: dict[tuple[Any, Any, Any], list[dict[str, Any]]] = defaultdict(list)
    false_alarms = 0
    rows: list[dict[str, Any]] = []
    for trial in trials:
        injections = trial.get("injections", [])
        detections = trial.get("detections", [])
        used: set[int] = set()
        for detection in detections:
            scores = [intersection_over_union(detection["mask"], item["mask"]) if i not in used else -1 for i, item in enumerate(injections)]
            index = int(np.argmax(scores)) if scores else -1
            score = scores[index] if index >= 0 else 0.0
            if index >= 0 and score >= iou_threshold:
                used.add(index)
                injection = injections[index]
                key = (injection.get("amplitude"), injection.get("sigma"), injection.get("geometry"))
                groups[key].append({"detected": True, "iou": score, "trial": trial})
            else:
                false_alarms += 1
        for index, injection in enumerate(injections):
            if index not in used:
                key = (injection.get("amplitude"), injection.get("sigma"), injection.get("geometry"))
                groups[key].append({"detected": False, "iou": 0.0, "trial": trial})
    for key, matches in groups.items():
        hits = sum(int(item["detected"]) for item in matches)
        low, high = wilson_interval(hits, len(matches))
        rows.append({"amplitude": key[0], "sigma": key[1], "geometry": key[2], "trials": len(matches), "detections": hits, "detection_probability": hits / len(matches), "wilson95": [low, high]})
    rows.sort(key=lambda row: (row["geometry"] or "", row["sigma"] or 0, row["amplitude"] or 0))
    return {"iou_threshold": iou_threshold, "false_alarm_rate_per_1000_km2": false_alarms / (len(trials) * area_km2) * 1000.0 if trials else 0.0, "conditions": rows}


def empirical_detection_limits(conditions: list[dict[str, Any]]) -> dict[str, float | None]:
    by_amplitude = sorted((float(row["amplitude"]), float(row["detection_probability"])) for row in conditions if row.get("amplitude") is not None)
    result: dict[str, float | None] = {"A50": None, "A90": None}
    for label, target in (("A50", 0.5), ("A90", 0.9)):
        for amplitude, probability in by_amplitude:
            if probability >= target:
                result[label] = amplitude
                break
    return result


def write_froc_json(summary: dict[str, Any], path: Path) -> None:
    path.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
