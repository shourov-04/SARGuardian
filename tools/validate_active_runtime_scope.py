#!/usr/bin/env python3
"""Enforce the evidence-based SARGuardian active runtime call graph and source pins."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCOPE_PATH = ROOT / "migration" / "active-runtime-scope.json"
KNOWN_PLACE_PIN_PATH = ROOT / "migration" / "active-runtime-pins" / "known-place-generic-0e061.json"
KNOWN_PLACE_FORK_OVERLAY_PATH = ROOT / "migration" / "active-runtime-pins" / "known-place-fork-overlay.json"


def fail(message: str) -> None:
    print(f"ACTIVE_RUNTIME_SCOPE_ERROR={message}", file=sys.stderr)
    raise SystemExit(1)


def require_file(relative: str) -> str:
    path = ROOT / relative
    if not path.is_file():
        fail(f"required runtime file is missing: {relative}")
    return path.read_text(encoding="utf-8")


def require_contains(relative: str, *needles: str) -> str:
    content = require_file(relative)
    for needle in needles:
        if needle not in content:
            fail(f"{relative} is missing required contract marker: {needle}")
    return content


def git_blob_sha(data: bytes) -> str:
    header = b"blob " + str(len(data)).encode("ascii") + b"\x00"
    return hashlib.sha1(header + data).hexdigest()


def validate_known_place_active_pin() -> None:
    try:
        manifest = json.loads(KNOWN_PLACE_PIN_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"cannot read active Known Place source-pin manifest: {exc}")
    if manifest.get("source_repository") != "moshiour0/SARGuardian-backend":
        fail("unexpected Known Place source repository")
    if manifest.get("source_workflow_commit") != "0e0611c12913044787ee84a39fa60a81d30ae516":
        fail("generic Known Place source pin must remain the exact active Backend runtime revision")
    if manifest.get("source_dispatcher_blob") != "90b254a68dae6c8449edeacf4ea205743ee89380":
        fail("generic Known Place Backend main dispatcher blob pin changed")
    if manifest.get("source_reusable_workflow_blob") != "844cdeefd2d78c74c623a4d910f9b6091789d79b":
        fail("generic Known Place reusable workflow blob pin changed")
    try:
        fork_overlay = json.loads(KNOWN_PLACE_FORK_OVERLAY_PATH.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        fail(f"cannot read current Known Place fork overlay provenance: {exc}")
    expected_overlay = {
        "source_repository": "shourov-04/SARGuardian",
        "source_commit_sha": "e9a346a4553780d2a43442892298daa7a4850163",
        "source_tree_sha": "ec31cc41c4afa7b73b5345d07966708c4988c326",
    }
    for key, value in expected_overlay.items():
        if fork_overlay.get(key) != value:
            fail(f"Known Place fork overlay provenance mismatch: {key}")
    overlay_rows = fork_overlay.get("files")
    expected_fork_overlay_files = {
        "engines/known-place/tools/know_place/aoi_runner.py": "a95e41a18cb37e3357188f597d88e005b2ae23a2",
        "engines/known-place/tools/tests/test_know_place_generic_magnitude_rejection.py": "0aa48bb894c823eabf685d5110ab860799e290fb",
        "engines/known-place/tools/tests/test_know_place_noise_floor.py": "841115f5a25b75674404695c2d17c5e5f9210230",
        "engines/known-place/tools/tests/test_know_place_reference_stationarity.py": "d5f1d7defd26fcde53060fa122889de2efc98f19",
        "engines/known-place/tools/validation/valkit.py": "4f2cf9e9c4ca4e1ee95b979bc2c121f7f0fb0ea8",
    }
    if not isinstance(overlay_rows, list) or len(overlay_rows) != len(expected_fork_overlay_files):
        fail("expected five exact, explicitly reviewed Known Place fork overlay files")
    observed_fork_overlay_files = {
        row.get("destination_path"): row.get("source_blob_sha")
        for row in overlay_rows if isinstance(row, dict)
    }
    if observed_fork_overlay_files != expected_fork_overlay_files:
        fail("Known Place fork overlay file inventory or SHA-256 pins changed")
    overlay = overlay_rows[0]
    overlay_path = "engines/known-place/tools/know_place/aoi_runner.py"
    overlay_sha = expected_fork_overlay_files[overlay_path]
    implementation_commits = {
        "6d7820987e8ee32a29ad48ea64ff8b39e033344c",
        "2bf5af598eb91825d94f822aa0ff13ab4b2f26d3",
        "e7fffd52e8b09e8bf281217dcfb1622ae0386cbb",
        "bde213694b12a274549c03fe1221b986b1cf4bc5",
        "ce2bd768ecd8b88be49a165626c378f8894511c3",
        "3447a8186fa5198ddea27c6755cf8989e1f40704",
    }
    if set(overlay.get("implementation_commits", [])) != implementation_commits:
        fail("Known Place fork overlay implementation commit set is incomplete")
    expected_tests = {
        "engines/known-place/tools/tests/test_know_place_noise_floor.py",
        "engines/known-place/tools/tests/test_know_place_reference_stationarity.py",
        "engines/known-place/tools/tests/test_know_place_generic_magnitude_rejection.py",
    }
    if set(overlay.get("verification_paths", [])) != expected_tests:
        fail("Known Place fork overlay verification test set is incomplete")
    for overlay_destination, expected_sha in expected_fork_overlay_files.items():
        overlay_file = ROOT / overlay_destination
        if not overlay_file.is_file():
            fail(f"Known Place fork overlay file is missing: {overlay_destination}")
        actual_sha = git_blob_sha(overlay_file.read_bytes())
        if actual_sha != expected_sha:
            fail(f"Known Place fork overlay blob mismatch: {overlay_destination}; expected={expected_sha}; actual={actual_sha}")
    files = manifest.get("files")
    if not isinstance(files, list) or len(files) != 10:
        fail("expected ten exact current-runtime Known Place overlays")
    seen: set[str] = set()
    for row in files:
        source = row.get("source_path")
        destination = row.get("destination_path")
        source_sha = row.get("source_blob_sha")
        if not isinstance(source, str) or not source or not isinstance(destination, str) or not destination.startswith("engines/known-place/") or destination in seen or not isinstance(source_sha, str) or len(source_sha) != 40:
            fail(f"invalid Known Place active-pin row: {row!r}")
        seen.add(destination)
        target = ROOT / destination
        if not target.is_file():
            fail(f"active Known Place overlay file is missing: {destination}")
        actual = git_blob_sha(target.read_bytes())
        expected_sha = overlay_sha if destination == overlay_path else source_sha
        if actual != expected_sha:
            fail(f"Known Place source blob mismatch: {destination}; expected={expected_sha}; actual={actual}")
    expected = {
        "engines/known-place/tools/know_place/aoi_request.py": "8fcfdf635994ceb6093160931f21ae6cf0f986de",
        "engines/known-place/tools/know_place/aoi_runner.py": "ef1f4b4f38b0078ad5ee7168f76deeeeeb4c72cd",
        "engines/known-place/tools/know_place/geometry.py": "25292440fd94426882a8c51b00b186b162de429a",
        "engines/known-place/tools/know_place/series.py": "63240179d45ddc37f3bd176594f2d2c7d75a11ab",
        "engines/known-place/tools/know_place/upload_bundle_to_drive.py": "ef721ee9e1d1b388927866054883440f95e1f2f6",
        "engines/known-place/tools/tests/test_know_place_aoi_runner.py": "149afb88a2e08ee001ca75107139f3662f9e14bf",
        "engines/known-place/tools/tests/test_know_place_geometry.py": "17d7b56cdb47af6d774c58d8abc9b33903be7144",
        "engines/known-place/tools/tests/test_know_place_series.py": "0d2e2e01f0c4792e2c7190c8613ac5b479a7e6fb",
        "engines/known-place/tools/tests/test_know_place_upload_bundle.py": "88bc0c613b05023658555f605104a2570266d7ba",
        "engines/known-place/app/storage/drive_client.py": "64aef9f7e3b6c4eee63d2ad9e21565be2ebed2a2",
    }
    observed = {row["destination_path"]: row["source_blob_sha"] for row in files}
    if observed != expected:
        fail("Known Place active source-pin manifest differs from the reviewed ten-file overlay")
    print("KNOWN_PLACE_ACTIVE_PIN_BLOB_PARITY=PASS source=0e0611c exact_files=9 fork_overlay=a95e41a")


def main() -> int:
    scope = json.loads(SCOPE_PATH.read_text(encoding="utf-8"))
    if scope.get("schema_version") != 1:
        fail("unsupported active runtime scope schema")
    paths = scope.get("runtime_paths")
    if not isinstance(paths, list) or len(paths) != 4:
        fail("expected four separately classified API feature paths")

    expected_primary = {
        ".github/workflows/sarguardian-aoi-wkt-dashboard.yml",
        ".github/workflows/sarguardian-aoi-dashboard-engine.yml",
        ".github/workflows/sarguardian-aoi-product-worker.yml",
        ".github/workflows/know-place-aoi-dispatcher.yml",
        ".github/workflows/know-place-aoi-analysis.yml",
    }
    expected_gated = {
        ".github/workflows/river-shift-gcov-process.yml",
        ".github/workflows/know-place-paper-reproduction-dispatcher.yml",
        ".github/workflows/know-place-author-exact-replay.yml",
    }
    primary = set(scope.get("runtime_workflow_allowlist", []))
    gated = set(scope.get("gated_feature_workflow_allowlist", []))
    preserved = set(scope.get("preserved_disabled_feature_workflow_allowlist", []))
    if primary != expected_primary:
        fail("primary runtime allowlist must contain Find Displacements and current generic Known Place call graphs")
    if gated != expected_gated:
        fail("gated features must contain RiverShift and the separate author-exact P05023 call graph")
    if preserved:
        fail("connected API workflows must not be silently placed in a preserved/unused bucket")
    all_feature = primary | gated
    if len(primary) + len(gated) != len(all_feature):
        fail("primary and gated workflow allowlists must be disjoint")

    expected_ci = {
        ".github/workflows/snapshot-regression-tests.yml",
        ".github/workflows/backend-source-regression-tests.yml",
        ".github/workflows/migration-metadata.yml",
        ".github/workflows/historical-secret-scan.yml",
        ".github/workflows/retention-archive-tests.yml",
        ".github/workflows/dashboard-assets-test.yml",
        ".github/workflows/sarguardian-aoi-code-validation.yml",
    }
    ci = set(scope.get("migration_ci_allowlist", []))
    if ci != expected_ci or ci & all_feature:
        fail("migration CI allowlist is invalid or overlaps product workflows")
    for path in all_feature | ci:
        require_file(path)

    require_contains("apps/api/app/main.py",
        '@app.post("/api/displacement-jobs"', "include_router(river_shift_jobs_router)",
        '@app.post("/api/known-place-analysis"', '@app.post("/api/known-place-paper-reproduction"')
    require_file("apps/web/package.json")
    require_file("apps/api/app/persistence.py")

    require_contains(".github/workflows/sarguardian-aoi-wkt-dashboard.yml",
        "workflow_dispatch:", "MONOREPO_DISPLACEMENT_ACTIONS_ENABLED",
        "uses: ./.github/workflows/sarguardian-aoi-dashboard-engine.yml")
    require_contains(".github/workflows/sarguardian-aoi-dashboard-engine.yml",
        "uses: ./.github/workflows/sarguardian-aoi-product-worker.yml", "max-parallel: 15",
        "migration/source-snapshots/nisar-pins/006d4cd")
    require_contains(".github/workflows/sarguardian-aoi-product-worker.yml",
        "006d4cd1485cf80e509eaf8717c12e9c6390ac09", "GOOGLE_DRIVE_PARENT_FOLDER_ID")

    require_contains("apps/api/app/config.py",
        '_flag(values, "DISPLACEMENT_ACTIONS_ENABLED", False)',
        "KNOWN_PLACE_GITHUB_ACTIONS_REPOSITORY", "KNOWN_PLACE_GITHUB_ACTIONS_WORKFLOW",
        "KNOWN_PLACE_GITHUB_ACTIONS_REF")
    require_contains("apps/api/app/known_place.py",
        "known_place_github_actions_repository", "dispatch_known_place_analysis",
        "scope_aoi_wkt", "reference_wkt")
    require_contains(".github/workflows/know-place-aoi-dispatcher.yml",
        "workflow_dispatch:", "MONOREPO_KNOWN_PLACE_ENABLED",
        "uses: ./.github/workflows/know-place-aoi-analysis.yml")
    require_contains(".github/workflows/know-place-aoi-analysis.yml",
        "KNOWN_PLACE_BACKEND_RUNTIME_PIN=0e0611c12913044787ee84a39fa60a81d30ae516",
        "9364b94d6629c67e44f007a0e2634824aa7e1f9f")
    validate_known_place_active_pin()

    require_contains(".github/workflows/river-shift-gcov-process.yml",
        "MONOREPO_RIVERSHIFT_PROCESSING_ENABLED", "max-parallel: 15", "retry_status:",
        "event_date:", "analysis_mode:")
    require_contains("engines/river-shift/tools/river_shift/batched_gcov_job.py",
        "GOOGLE_DRIVE_PARENT_FOLDER_ID")

    require_contains(".github/workflows/know-place-paper-reproduction-dispatcher.yml",
        "uses: ./.github/workflows/know-place-author-exact-replay.yml",
        "b825df798ea4cb9874aa10dd01174d2a8ef73cba", "[run-know-place]")
    require_contains(".github/workflows/know-place-author-exact-replay.yml",
        "MONOREPO_KNOWN_PLACE_PAPER_REPRODUCTION_ENABLED",
        "b825df798ea4cb9874aa10dd01174d2a8ef73cba", "[run-know-place]")

    config = require_contains("apps/api/app/config.py",
        '_flag(values, "DISPLACEMENT_ACTIONS_ENABLED", False)',
        '_flag(values, "RIVERSHIFT_ACTIONS_ENABLED", False)')
    if "DISPLACEMENT_ACTIONS_ENABLED=true" in config or "RIVERSHIFT_ACTIONS_ENABLED=true" in config:
        fail("API runtime defaults must remain fail-closed")

    disposition = json.loads((ROOT / "migration" / "workflow-dispositions.json").read_text(encoding="utf-8"))
    instances = disposition.get("workflow_instances", [])
    if len(instances) != 82:
        fail("all 82 source workflow instances must remain preserved as provenance")
    counts = {item["id"]: item["expected_workflow_count"] for item in disposition.get("sources", [])}
    if counts != {"dynamic-main": 7, "backend-main": 35, "backend-known-place-pr85": 40}:
        fail(f"unexpected source workflow provenance counts: {counts}")

    evidence = scope.get("evidence", {})
    fd = evidence.get("find_displacements", {})
    if not (fd.get("conclusion") == "success" and fd.get("jobs_total") == 20
            and fd.get("jobs_success") == 19 and fd.get("jobs_failed_initial_attempt") == 1
            and fd.get("retry_conclusion") == "success"
            and fd.get("final_dashboard_conclusion") == "success"
            and fd.get("terminal_callback_conclusion") == "success"):
        fail("Find Displacements primary runtime evidence is incomplete or inconsistent")
    rs = evidence.get("river_shift", {})
    if not (rs.get("error_code") == "EVENT_WINDOW_NOT_BRACKETED"
            and rs.get("catalogue_exact_matches") == 14
            and rs.get("product_batches_started") is False):
        fail("RiverShift evidence must retain the observed fail-closed eligibility distinction")
    kp = evidence.get("known_place", {})
    dispatch = kp.get("dispatch_query_first_page", {})
    if not (kp.get("generic_backend_science_ref") == "0e0611c12913044787ee84a39fa60a81d30ae516"
            and kp.get("two_polygon_pr_state") == "open"
            and kp.get("two_polygon_pr_draft") is True
            and kp.get("two_polygon_pr_merged") is False
            and dispatch.get("records_returned") == 100
            and dispatch.get("generic_dispatches") == 16
            and dispatch.get("generic_success") == 8
            and dispatch.get("generic_failure") == 7
            and dispatch.get("author_exact_dispatches") == 1
            and dispatch.get("author_exact_failure") == 1):
        fail("Known Place active-run evidence or unmerged feature-branch lineage is stale/inconsistent")
    author = kp.get("author_exact", {})
    if not (author.get("last_run_id") == 41423614257
            and author.get("conclusion") == "failure"
            and author.get("cleanup_error") == "SOURCE_MANIFEST_STATUS_NOT_COMPLETE"):
        fail("Author-Exact P05023 must remain gated until a complete successful replay is evidenced")

    print("ACTIVE_RUNTIME_SCOPE=PASS "
          f"primary_runtime_workflows={len(primary)} gated_feature_workflows={len(gated)} "
          f"migration_ci_workflows={len(ci)} api_feature_paths={len(paths)} "
          f"source_workflow_instances={len(instances)}")
    print("PRIMARY_RUNTIME=find-displacements,known-place-generic")
    print("GATED_FEATURES=river-shift,known-place-author-exact-p05023")
    print("NOTE=source_snapshot_provenance_does_not_activate_unused_workflows_or_claim_production_cutover")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
