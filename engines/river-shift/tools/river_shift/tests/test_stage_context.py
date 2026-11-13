import json

from river_shift.stage_context import load_stage_context


def test_stage_context_matches_without_interpolation(tmp_path):
    path = tmp_path / "stage.json"
    path.write_text(json.dumps({"observations": [
        {"date": "2026-07-01", "stage": 2.0},
        {"date": "2026-07-03", "stage": 2.2},
    ]}), encoding="utf-8")
    result = load_stage_context(
        path,
        {"before": "2026-07-01", "during": "2026-07-03"},
        maximum_offset_days=0,
        comparable_range=0.3,
    )
    assert result["observations"]["during"]["stage"] == 2.2
    assert result["comparable_within_declared_range"] is True


def test_stage_context_marks_missing_temporal_match(tmp_path):
    path = tmp_path / "stage.csv"
    path.write_text("date,stage\n2026-07-01,2.0\n", encoding="utf-8")
    result = load_stage_context(path, {"during": "2026-07-10"}, maximum_offset_days=2)
    assert result["observations"]["during"]["status"] == "NO_CLOSE_STAGE_OBSERVATION"
    assert result["comparable_within_declared_range"] is None
