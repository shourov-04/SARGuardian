#!/usr/bin/env python3
"""Compare imported monorepo snapshot entries with their exact source Git trees."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Snapshot:
    label: str
    source_sha: str
    destination_prefix: str
    source_tree_sha: str | None = None


SNAPSHOTS = (
    Snapshot(
        "Dynamic main",
        "dd64b7adc90594f1d7f316b352e39fbac2013cb6",
        "migration/source-snapshots/dynamic",
    ),
    Snapshot(
        "Backend main",
        "97d849454918b1425ac41bb70e7a32d11cfd3833",
        "migration/source-snapshots/backend-main",
    ),
    Snapshot(
        "Known Place PR #85 head",
        "bfde7dde8ada92a03054cd8dbad8daa7a5c119f8",
        "migration/source-snapshots/backend-known-place-pr85",
    ),
    Snapshot(
        "NISAR science main",
        "9fcb543ef28a7f6fe70a379aed9cfe3e43e277ec",
        "migration/source-snapshots/nisar-science",
    ),
    Snapshot(
        "NISAR historical pin 10639",
        "10639a916c9829850775410b3ed7de62e527770d",
        "migration/source-snapshots/nisar-pins/10639a9",
    ),
    Snapshot(
        "NISAR historical pin 006d",
        "006d4cd1485cf80e509eaf8717c12e9c6390ac09",
        "migration/source-snapshots/nisar-pins/006d4cd",
    ),
    Snapshot(
        "Dynamic historical callback API pin db6472",
        "db6472e1c304e21242f1ab1dfd671ccb21ba5697",
        "migration/source-snapshots/dynamic-pins/db6472",
    ),
    Snapshot(
        "Backend historical reassembly pin d9e67",
        "d9e67df7d800032c37d23f74df44c98e3ab655f7",
        "migration/source-snapshots/backend-pins/d9e67",
    ),
    Snapshot(
        "Legacy Sagormodak science pin 77cc964",
        "77cc9646cfa46d3aff3669d351912f984cf67aa3",
        "migration/source-snapshots/legacy-fork/77cc964",
    ),
    Snapshot(
        "Known Place author-exact backend code pin b825df",
        "b825df798ea4cb9874aa10dd01174d2a8ef73cba",
        "migration/source-snapshots/backend-pins/b825df",
        "3c77b2d52474364020acebeb4338b5babe7ff4ec",
    ),
)

ANCESTOR_CHECKS = (
    (
        "Known Place feature branch base",
        "bd7a59c54ddae7c19fd88896e877c3a530b43d9e",
        "bfde7dde8ada92a03054cd8dbad8daa7a5c119f8",
    ),
    (
        "Historical extended-science pin",
        "ab547ecc82bcc4d6ccef545a59852536c2beacc6",
        "9fcb543ef28a7f6fe70a379aed9cfe3e43e277ec",
    ),
)


def git(*args: str) -> bytes:
    completed = subprocess.run(
        ["git", *args],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if completed.returncode:
        message = completed.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"git {' '.join(args)} failed: {message}")
    return completed.stdout


def tree_entries(revision: str) -> dict[str, tuple[str, str, str]]:
    """Return path -> (mode, object type, object SHA), preserving raw path names."""
    raw = git("ls-tree", "-r", "-z", "--full-tree", revision)
    result: dict[str, tuple[str, str, str]] = {}
    for record in raw.split(b"\0"):
        if not record:
            continue
        try:
            metadata, path_bytes = record.split(b"\t", 1)
            mode, object_type, object_sha = metadata.decode("ascii").split(" ")
            path = path_bytes.decode("utf-8")
        except (ValueError, UnicodeDecodeError) as exc:
            raise RuntimeError(f"Cannot parse git ls-tree record: {exc}") from exc
        result[path] = (mode, object_type, object_sha)
    return result


def check_ancestor(label: str, ancestor: str, descendant: str) -> None:
    result = subprocess.run(
        ["git", "merge-base", "--is-ancestor", ancestor, descendant],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
    )
    if result.returncode == 1:
        raise RuntimeError(
            f"{label} is not preserved as an ancestor: {ancestor} -> {descendant}"
        )
    if result.returncode != 0:
        message = result.stderr.decode("utf-8", errors="replace").strip()
        raise RuntimeError(f"Cannot verify {label}: {message}")
    print(f"ANCESTRY_PASS {label}: {ancestor} -> {descendant}")



def load_promotion_overrides() -> dict[str, dict[str, str]]:
    """Load hash-pinned, path-preserving edits to explicitly promoted files only."""
    manifest_path = Path(__file__).resolve().parents[1] / "migration" / "promotion-overrides.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Cannot read promotion override manifest: {exc}") from exc
    if not isinstance(manifest, dict) or manifest.get("schema_version") != "1.0":
        raise RuntimeError("Promotion override manifest has an unsupported schema.")
    rows = manifest.get("approved_overrides")
    if not isinstance(rows, list):
        raise RuntimeError("Promotion override manifest must contain an approved_overrides array.")

    promotion_roots = {
        "Dynamic active API promotion": {
            "source": "migration/source-snapshots/dynamic/Backend/",
            "destination": "apps/api/",
            "verification": "apps/api/tests/",
        },
        "Dynamic frontend promotion": {
            "source": "migration/source-snapshots/dynamic/Frontend/",
            "destination": "apps/web/",
            "verification": "apps/web/src/",
        },
        "Find Displacements tools promotion": {
            "source": "migration/source-snapshots/backend-main/tools/",
            "destination": "engines/find-displacements/tools/",
            "verification": "engines/find-displacements/tools/tests/",
        },
    }
    approved: dict[str, dict[str, str]] = {}
    for row in rows:
        if not isinstance(row, dict):
            raise RuntimeError("Promotion override row must be an object.")
        scope = row.get("promotion_scope")
        roots = promotion_roots.get(scope) if isinstance(scope, str) else None
        source_path = row.get("source_path")
        destination_path = row.get("destination_path")
        if (
            roots is None
            or not isinstance(source_path, str)
            or not source_path.startswith(roots["source"])
            or not isinstance(destination_path, str)
            or not destination_path.startswith(roots["destination"])
        ):
            raise RuntimeError("Promotion override scope, source and destination roots do not match an approved promotion.")
        relative_source = source_path[len(roots["source"]):]
        relative_destination = destination_path[len(roots["destination"]):]
        if not relative_source or relative_source != relative_destination or ".." in Path(relative_source).parts:
            raise RuntimeError(f"Promotion override source/destination paths do not correspond: {source_path}.")
        source_sha = row.get("source_blob_sha")
        destination_sha = row.get("destination_blob_sha")
        if (
            not isinstance(source_sha, str) or not re.fullmatch(r"[0-9a-f]{40}", source_sha)
            or not isinstance(destination_sha, str) or not re.fullmatch(r"[0-9a-f]{40}", destination_sha)
            or row.get("mode") != "100644" or row.get("object_type") != "blob"
        ):
            raise RuntimeError(f"Promotion override has an invalid Git object pin: {destination_path}.")
        reason = row.get("reason")
        commits = row.get("implementation_commits")
        tests = row.get("verification_paths")
        if (
            not isinstance(reason, str) or len(reason.strip()) < 20
            or not isinstance(commits, list) or not commits
            or any(not isinstance(item, str) or not re.fullmatch(r"[0-9a-f]{40}", item) for item in commits)
            or not isinstance(tests, list) or not tests
            or any(
                not isinstance(item, str)
                or not item.startswith(roots["verification"])
                or not ("/tests/" in item or ".test." in item or ".spec." in item)
                for item in tests
            )
        ):
            raise RuntimeError(f"Promotion override lacks reviewable reason, commit or test evidence: {destination_path}.")
        override_key = f"{scope}:{relative_source}"
        if override_key in approved:
            raise RuntimeError(f"Duplicate promotion override for {destination_path}.")
        approved[override_key] = row
    return approved



def verify_source_branch_archives(target_entries: dict[str, tuple[str, str, str]]) -> int:
    """Verify archived RiverShift validation refs against exact source blob pins.

    These are evidence snapshots, not activated workflows or full source-tree
    imports. Their Git blob identities must remain exact and every archived
    file must be accounted for by the provenance manifest.
    """
    manifest_path = (
        Path(__file__).resolve().parents[1]
        / "migration"
        / "source-branch-snapshots"
        / "rivershift-validation-pins.json"
    )
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Cannot read RiverShift source-branch pin manifest: {exc}") from exc
    if not isinstance(manifest, dict) or manifest.get("schema_version") != "1.0":
        raise RuntimeError("RiverShift source-branch pin manifest has an unsupported schema.")
    if manifest.get("policy") != "ARCHIVAL_SNAPSHOTS_WITH_SEPARATE_REVIEWED_ROOT_PORTS":
        raise RuntimeError("RiverShift source-branch snapshots must remain explicitly archival-only.")

    sources = manifest.get("sources")
    if not isinstance(sources, list) or not sources:
        raise RuntimeError("RiverShift source-branch manifest must contain source entries.")

    expected_paths: set[str] = set()
    verified = 0
    for source in sources:
        if not isinstance(source, dict):
            raise RuntimeError("RiverShift source-branch entry must be an object.")
        if source.get("source_repository") != "moshiour0/SARGuardian-backend":
            raise RuntimeError("Unexpected repository in RiverShift source-branch manifest.")
        source_head = source.get("source_head_commit")
        if not isinstance(source_head, str) or not re.fullmatch(r"[0-9a-f]{40}", source_head):
            raise RuntimeError("RiverShift source-branch manifest has an invalid source commit pin.")
        prefix = source.get("destination_prefix")
        if (
            not isinstance(prefix, str)
            or not prefix.startswith("migration/source-branch-snapshots/")
            or not prefix.endswith("/")
            or ".." in Path(prefix).parts
        ):
            raise RuntimeError("RiverShift archive destination must remain under migration/source-branch-snapshots/.")
        rows = source.get("files")
        if not isinstance(rows, list) or not rows:
            raise RuntimeError(f"RiverShift archive {source_head} has no pinned files.")
        for row in rows:
            if not isinstance(row, dict):
                raise RuntimeError("RiverShift source-branch file pin must be an object.")
            source_path = row.get("source_path")
            destination_path = row.get("destination_path")
            source_blob = row.get("source_blob_sha")
            destination_blob = row.get("destination_blob_sha")
            if (
                not isinstance(source_path, str)
                or source_path.startswith("/")
                or ".." in Path(source_path).parts
                or not isinstance(destination_path, str)
                or not destination_path.startswith(prefix)
                or ".." in Path(destination_path).parts
                or not isinstance(source_blob, str)
                or not re.fullmatch(r"[0-9a-f]{40}", source_blob)
                or destination_blob != source_blob
            ):
                raise RuntimeError(f"Invalid or non-identical RiverShift archive blob pin: {destination_path!r}.")
            if destination_path in expected_paths:
                raise RuntimeError(f"Duplicate RiverShift archive destination: {destination_path}.")
            expected_paths.add(destination_path)
            if source_path.startswith(".github/workflows/"):
                active_copy = (
                    Path(__file__).resolve().parents[1]
                    / ".github"
                    / "workflows"
                    / Path(source_path).name
                )
                if active_copy.exists():
                    active_relative = f".github/workflows/{Path(source_path).name}"
                    active_entry = target_entries.get(active_relative)
                    if active_entry is None or active_entry[2] == source_blob:
                        raise RuntimeError(
                            f"Active RiverShift root workflow must be a distinct promoted port, not an identical archive copy: {active_copy}"
                        )
                    active_text = active_copy.read_text(encoding="utf-8")
                    if (
                        "workflow_dispatch:" not in active_text
                        or re.search(r"(?m)^\s*push\s*:", active_text)
                        or not re.search(r"MONOREPO_RIVERSHIFT_[A-Z0-9_]+", active_text)
                        or '!= "true"' not in active_text
                    ):
                        raise RuntimeError(
                            f"Promoted RiverShift root workflow is not manual-only and fail-closed: {active_copy}"
                        )
                    print(
                        f"SOURCE_BRANCH_ROOT_PORT_PASS {active_relative}: "
                        "distinct_blob manual_only fail_closed"
                    )
            actual = target_entries.get(destination_path)
            expected = ("100644", "blob", source_blob)
            if actual != expected:
                raise RuntimeError(
                    f"RiverShift source-branch archive blob mismatch: {destination_path}; "
                    f"expected={expected}; actual={actual}"
                )
            verified += 1
            print(f"SOURCE_BRANCH_ARCHIVE_BLOB_PASS {destination_path}: {source_blob}")

    archive_prefix = "migration/source-branch-snapshots/"
    actual_paths = {
        path for path in target_entries
        if path.startswith(archive_prefix) and path != (
            archive_prefix + "rivershift-validation-pins.json"
        )
    }
    missing = sorted(expected_paths - actual_paths)
    extra = sorted(actual_paths - expected_paths)
    if missing or extra:
        raise RuntimeError(
            f"RiverShift source-branch archive manifest mismatch: missing={missing[:10]}; extra={extra[:10]}"
        )
    print(
        f"SOURCE_BRANCH_ARCHIVE_MANIFEST_PASS files={verified} sources={len(sources)}; "
        "separate_root_ports=manual_only_fail_closed"
    )
    return verified

def main() -> int:
    target = git("rev-parse", "HEAD").decode("ascii").strip()
    target_entries = tree_entries(target)
    print(f"TARGET_COMMIT={target}")
    print(f"TARGET_TRACKED_ENTRIES={len(target_entries)}")

    total = 0
    archived_branch_files = verify_source_branch_archives(target_entries)
    for snapshot in SNAPSHOTS:
        # Divergent code pins can be preserved by their exact tree even when
        # their full commit history is not an ancestor of an imported branch.
        tree_revision = snapshot.source_tree_sha or snapshot.source_sha
        git("cat-file", "-e", f"{tree_revision}^{{tree}}")
        source_entries = tree_entries(tree_revision)
        prefix = snapshot.destination_prefix + "/"
        imported_entries = {
            path[len(prefix) :]: entry
            for path, entry in target_entries.items()
            if path.startswith(prefix)
        }

        missing = sorted(set(source_entries) - set(imported_entries))
        extra = sorted(set(imported_entries) - set(source_entries))
        changed = sorted(
            path
            for path in set(source_entries) & set(imported_entries)
            if source_entries[path] != imported_entries[path]
        )
        if missing or extra or changed:
            details = [
                f"{snapshot.label}: expected={len(source_entries)} imported={len(imported_entries)}",
                f"missing sample={missing[:10]}",
                f"extra sample={extra[:10]}",
                f"changed object sample={changed[:10]}",
            ]
            raise RuntimeError("; ".join(details))

        total += len(source_entries)
        source_identity = (
            f"commit={snapshot.source_sha} tree={tree_revision}"
            if snapshot.source_tree_sha
            else f"commit={snapshot.source_sha}"
        )
        print(
            f"SNAPSHOT_BLOB_INTEGRITY_PASS {snapshot.label}: "
            f"{len(source_entries)} entries {source_identity}"
        )

    promotion_overrides = load_promotion_overrides()
    used_promotion_overrides: set[str] = set()

    promoted_paths = (
        (
            "Dynamic frontend promotion",
            "migration/source-snapshots/dynamic/Frontend/",
            "apps/web/",
            (
                "landslide/ui/displacementPreparation.css",
                "public/sarguardian-logo.png",
                "public/scenery/",
                "src/components/BrandLogo.tsx",
                "src/pages/HowItWorksPage.tsx",
                "src/useGlassPointer.ts",
            ),
        ),
        (
            "Dynamic active API promotion",
            "migration/source-snapshots/dynamic/Backend/",
            "apps/api/",
            (),
        ),
        (
            "Dynamic shared tools promotion",
            "migration/source-snapshots/dynamic/tools/",
            "apps/tools/",
            (),
        ),
        (
            "Dynamic workflow compatibility promotion",
            "migration/source-snapshots/dynamic/.github/workflows/",
            "apps/.github/workflows/",
            (),
        ),
        (
            "Known Place PR #85 promotion (excluding separately pinned active generic runtime overlay)",
            "migration/source-snapshots/backend-known-place-pr85/",
            "engines/known-place/",
            (
                "tools/know_place/aoi_request.py",
                "tools/know_place/aoi_runner.py",
                "tools/know_place/geometry.py",
                "tools/know_place/series.py",
                "tools/know_place/upload_bundle_to_drive.py",
                # Current-fork test/validation overlays are pinned separately.
                "tools/tests/test_know_place_generic_magnitude_rejection.py",
                "tools/tests/test_know_place_noise_floor.py",
                "tools/tests/test_know_place_reference_stationarity.py",
                "tools/validation/valkit.py",
                "tools/tests/test_know_place_aoi_runner.py",
                "tools/tests/test_know_place_geometry.py",
                "tools/tests/test_know_place_series.py",
                "tools/tests/test_know_place_upload_bundle.py",
                "app/storage/drive_client.py",
            ),
        ),
        (
            "NISAR science promotion",
            "migration/source-snapshots/nisar-science/",
            "science/nisar-core/",
            (),
        ),
        (
            "Find Displacements dashboard promotion",
            "migration/source-snapshots/backend-main/dashboard/",
            "engines/find-displacements/dashboard/",
            (),
        ),
        (
            "Find Displacements tools promotion",
            "migration/source-snapshots/backend-main/tools/",
            "engines/find-displacements/tools/",
            ("river_shift/",),
        ),
        (
            "RiverShift GCOV engine promotion",
            "migration/source-snapshots/backend-main/tools/river_shift/",
            "engines/river-shift/tools/river_shift/",
            # These two Monorepo-only helpers are reviewed by the retained replay
            # contract suite below; the imported engine files remain byte-identical.
            ("replay_retained_run36_monorepo.py", "verify_monorepo_source_run.py"),
        ),
        (
            "Supabase configuration and migration promotion",
            "migration/source-snapshots/dynamic/Backend/supabase/",
            "infrastructure/supabase/",
            # These Monorepo-only additions are not source snapshot files:
            # - README.md documents the isolated target project and key setup.
            # - the retention migration is a separately reviewed forward migration.
            (
                "README.md",
                # SQL filenames are aligned to the target project's actual remote
                # migration timestamps; their unchanged source blobs are verified
                # against migration/supabase-history-alignment.json below.
                "migrations/",
            ),
        ),
    )
    # Reviewed Monorepo frontend promotion baseline. These paths were already
    # promoted before the snapshot verifier was introduced; retain explicit
    # audit visibility without treating their known destination deltas as a
    # new source-import mutation.
    dynamic_frontend_baseline_exceptions = {
        "index.html", "landslide/tests/displacementPreparation.test.tsx",
        "landslide/ui/DisplacementPreparation.tsx", "landslide/ui/KnownPlaceAnalysisPanel.tsx",
        "landslide/ui/KnownPlacePolygonEditor.tsx", "landslide/ui/LandslidePage.tsx",
        "landslide/ui/ScientificResults.tsx", "landslide/ui/knownPlacePreflight.ts",
        "landslide/tests/investigationModes.test.tsx", "landslide/ui/knownPlacePreflight.test.ts",
        "landslide/ui/sessionState.test.ts", "landslide/ui/sessionState.ts",
        "landslide/ui/workspace.css", "src/App.tsx", "src/api/catalog.ts",
        "src/api/knownPlace.ts",
        "src/components/Footer.tsx", "src/components/Header.tsx",
        "src/components/Hero.tsx", "src/components/ProfileControl.tsx",
        "src/data/engineData.test.ts", "src/data/engineData.ts", "src/index.css",
        "src/pages/ArchivePage.tsx", "src/pages/Home.tsx", "src/pages/HomeSections.tsx",
        "src/pages/RiverShiftPage.tsx", "src/routing.test.ts", "src/routing.ts", "vercel.json",
    }
    dynamic_api_baseline_exceptions = {
        ".env.example", "app/config.py", "app/known_place.py", "app/main.py",
        "app/persistence.py", "tests/test_config.py", "tests/test_displacements.py",
        "tests/test_known_place.py",
    }
    dynamic_api_destination_only = {
        # Retention migration and retry feature are reviewed Monorepo-owned additions.
        "supabase/migrations/20261107120000_displacement_job_retention.sql": "682fe1f67f1de10705010a1be0d9d45abecd9f3d",
        "app/river_shift_retry.py": "0606f27361bc7b75195db892ac9f3bc107ce8f33",
        "tests/test_river_shift_retry.py": "4afe5c809b688acdbe7b5d27115eca15b24dd6a8",
    }
    dynamic_api_changed_blob_pins = {
        # Exact source/destination Git blob identities for the reviewed retry integration.
        "app/river_shift_jobs.py": ("e3c702c854e8381d84d09a0db8b85fcaaa89328a", "9e2d21b6d74be563fe957e2088f64bfa895a3aef"),
        "pytest.ini": ("3da0c0f7caa2b0bc0f2a0130542c0698a829f991", "f1fea8142b67d84e264e68a9a022990c378ca172"),
        "tests/test_main.py": ("2bc956c3a4a5c2a347677b38772955283da70ea2", "64f19019ee750af10dddf97305424b14aebbe7b7"),
        "tests/test_river_shift_jobs.py": ("fe9916362b343d14b9add6cb480c23496c10924c", "7bc621b17fce217a1f24946b49d0e0d8205ad689"),
    }
    # Reviewed destination-only Known Place result route and the exact CSS
    # transformation already introduced by commits 72cc1dde and 978862c0.
    # Blob pins keep later edits visible to this provenance gate.
    dynamic_frontend_destination_only = {
        "landslide/ui/KnownPlaceResultsPage.tsx": "9aaa674bf3a028aa86018e189687132a6695316b",
        # Monorepo-owned RiverShift routes are additional to the Dynamic snapshot.
        "src/pages/RiverShiftProcessingPage.tsx": "50e257de9ab8a0f0cbf25d023d6cc4fe620b70d7",
        "src/pages/RiverShiftProcessingPage.test.tsx": "38704de03b1e6b5033155fed06083944351dddf0",
        "src/pages/RiverShiftResultsPage.tsx": "40233f2de7d394e2189c6c92e812802b1cde4f34",
        "src/pages/RiverShiftResultsPage.test.tsx": "098b25d02bedf58a7e2dd2dbae6445d080fdb090",
    }
    dynamic_frontend_changed_blob_pins = {
        "landslide/ui/landslide.css": (
            "554b975bff72abde25fa268d5e85b94c6110dc66",
            "4891a2529405a4fbf95d924da666fa4bf5d59794",
        ),
        # Exact Git blob pins for reviewed frontend design/product adaptations.
        "README.md": ("cda57b87c8815a1fc82771e5622fca79313ca352", "70e458613f5f7847f733cdb0b4d8b23ff2119509"),
        "landslide/tests/validation.test.ts": ("6f7f988aee0e16f952bb8b0f172131a435ad833b", "d3627c09f7d7e31976626bbc96056c15f98a7e13"),
        "landslide/ui/KnownPlaceGoogleMap.tsx": ("fe37553f5a6a51a068b1cbabe1e1f15df86a8534", "d82eac32f179199368817865f5b41dc3328338e1"),
        "landslide/ui/KnownPlaceResultsDashboard.tsx": ("1502f365a96d672615d7e50a30e707084323d5ad", "e36ceaf2c67aaf23ce0d7cd3d5031e99fe7122c3"),
        "landslide/ui/knownPlaceResults.css": ("0fb85bab47ebd062672dffebb07f03c652485359", "2c62de74b3ad71e7f3d78c6ca75e9ba77465d6f6"),
        "src/api/catalog.test.ts": ("c6290e0ebb585213ffab4b58f74a9f5d4850808c", "d2ae34db4ec1dce5c4c0b8a23ab4eebdc60c1a9a"),
        "src/dashboardDocument.ts": ("681950427d67455c38ecf83e2962faee45ba2316", "d632b0cf53282aa8985d1db65220636d86b91239"),
        "src/pages/DashboardPage.test.tsx": ("1e3fc95825eea1fd9df9583d664825e725a44d5f", "42166590f50249220bf1a3ed159faac87b619105"),
        "src/pages/DashboardPage.tsx": ("ab024025925e88299c6a09e961f57afdc3fcf450", "b5c64354cdea6dc9c610c1f6e28469584d6d75e0"),
        "src/pages/river-shift.css": ("1c9bc4f4868aced2978129518e62e12c9779a22b", "f58b10d5b22df2e7c9fe19a5df0eb87047e16017"),
        # RiverShift's current frontend map/impact contracts have five reviewed
        # destination adaptations; exact source/destination blobs prevent drift.
        "src/riverShift/generalChangeMarkers.ts": ("762a5f9b860ffb9ed0dfac861a458cf70b3cd78b", "596c2f0fce37437fdec811f4841b5102cea6cc00"),
        "src/riverShift/impactContext.test.ts": ("9bbae28e8b0c4f707ab8991ed8a97e7b614ad4a3", "5be8d51fb173646a42043eb3684d5f73adf5c7cc"),
        "src/riverShift/impactContext.ts": ("ea1d7e6ebca311186dbcf916e6c27c85c83cfb68", "35a05a94f94f45333f16191db0ba0d819cdfc077"),
        "src/riverShift/manifest.test.ts": ("8f2201be952c82225ac335d40df32af3bbd23990", "44b2a04ea3f4bb6f5855f529915e31b295bff4ac"),
        "src/riverShift/manifest.ts": ("c969ca762cb9e84dccf4b8920599590116e4fee2", "a30797b499b356f6d713bada9eb4d6fdc71da09b"),
    }
    nisar_science_destination_only = {
        "tests/test_elevation_regression.py": "20d5e44346dba913a0452d8fcb7277b069aba720",
        "tests/test_gls_persistence.py": "9f8d275d4a2c486a735594c5165f8c6d38a28e65",
        "tests/test_gnss_benchmark.py": "d6da8acbbb28fd3d9e47274144b491d2a977b89a",
        "tests/test_injection.py": "d4b68c8ad31e2b78aeb0a72db003a5a6691803bd",
        "tests/test_stable_datum.py": "eb5c204b40e6ca2562b57a7e4ee90e38058af4bc",
        "tests/test_surrogates.py": "c06c3267883b78714edc5d5e12b3332702d321bd",
        "tests/test_validation_receipt.py": "eb540088ce8038c065f460c946296cf4ce382514",
        "tests/test_vector_decomposition.py": "80a990e18956b3e21e02edf671c9d81749ae216c",
        "validation/__init__.py": "6c23bc4d036c265e265611a1aa488e32005667d4",
        "validation/elevation_regression.py": "de8bac65dad2300150ec2e1437c7343a42e6b3c1",
        "validation/froc.py": "4807df2a6c30c8bb98670458bf6f6d6f109cff0c",
        "validation/gls_persistence.py": "ee4407bcd40328afce2df1d760ed336a4ec1ec45",
        "validation/gnss_benchmark.py": "74787722f227bd875c850536c6ca8d745f31f694",
        "validation/injection.py": "846d7398e938391f6c2f314cdcff9d8a5fcb241c",
        "validation/run_injection_benchmark.py": "ed0ca04c44f3f465341485bf84c144df71a6db00",
        "validation/stable_datum.py": "6e576f50149f11d66dd4105bf4b025a4e289b34b",
        "validation/surrogates.py": "9da5daebc8cc6e57b79c5628ba0e347372ed140b",
        "validation/validation_receipt.py": "aa5898e4dcc2f351f7eb26da6f826757519dddf6",
        "validation/vector_decomposition.py": "69bbffc5bfc6538869e125498c3faa25e4e0c1c2"
    }
    find_tools_changed_blob_pins = {
        "aoi_wide_displacement_screen.py": ("cea9a8bd7f95a3107f3aec0bbc66f9bdce253141", "b66a7642ca8ebcbeba105ff215cc2b62c2b1d0fd"),
        "tests/test_aoi_wide_displacement_screen.py": ("5a3666c0b430758f7f21c00f75d1a791a9cee545", "d0d8277a40f6277e6f5179f766b161acfb685b72"),
    }
    find_dashboard_changed_blob_pins = {
        "assets/prepare_web_assets.py": ("40408efe792927266ec4a864ded212b1a3c69cd4", "b301e0e60a188935066f96ce85101fc89540a584"),
        "tests/test_prepare_web_assets.py": ("8310651f82b6e362c3a60c95c18936adc4652c62", "94de4492e0f06ca7774b673f2b0e457515cad8ec"),
    }
    nisar_science_changed_blob_pins = {
        "src/goff_reader.py": ("8a00a5ae51ee5d6d9c67c46ea64f202169621a1b", "37a0d312d37f837664601783d4c951adc5d85f49"),
        "tests/conftest.py": ("f631634824553a111b2c08279cb8432b04466207", "570588d984297744969827a592e770c1b751e803"),
    }
    river_shift_changed_blob_pins = {
        "tests/test_independent_reference_runner.py": (
            "f7c7a657076da3eaa2e9e8c99a7677106058d768",
            "0ca8093864dcd6e2b537f08ad0631b6de103001a",
        ),
    }
    dynamic_shared_tools_baseline_exceptions = {"run_export_science_diagnostics.py"}
    find_tools_baseline_exceptions = {"run_export_science_diagnostics.py"}
    for label, source_prefix, destination_prefix, excluded_prefixes in promoted_paths:
        source_view = {
            path[len(source_prefix) :]: entry
            for path, entry in target_entries.items()
            if path.startswith(source_prefix)
            and not any(
                path[len(source_prefix) :].startswith(excluded)
                for excluded in excluded_prefixes
            )
        }
        destination_view = {
            path[len(destination_prefix) :]: entry
            for path, entry in target_entries.items()
            if path.startswith(destination_prefix)
            and not any(
                path[len(destination_prefix) :].startswith(excluded)
                for excluded in excluded_prefixes
            )
            and not (
                label == "Dynamic active API promotion"
                and path[len(destination_prefix) :] in dynamic_api_destination_only
            )
            and not (
                label == "Dynamic frontend promotion"
                and path[len(destination_prefix) :] in dynamic_frontend_destination_only
            )
            and not (
                label == "NISAR science promotion"
                and path[len(destination_prefix) :] in nisar_science_destination_only
            )
        }
        if label == "Dynamic active API promotion":
            for relative_path, expected_sha in dynamic_api_destination_only.items():
                actual_entry = target_entries.get(f"{destination_prefix}{relative_path}")
                if actual_entry != ("100644", "blob", expected_sha):
                    raise RuntimeError(f"Reviewed API destination-only blob changed: {relative_path}")
                print(f"PROMOTED_API_ADDITION_PASS apps/api/{relative_path}: {expected_sha}")
        if label == "NISAR science promotion":
            for relative_path, expected_sha in nisar_science_destination_only.items():
                actual_entry = target_entries.get(f"{destination_prefix}{relative_path}")
                if actual_entry != ("100644", "blob", expected_sha):
                    raise RuntimeError(f"Reviewed NISAR science destination-only blob changed: {relative_path}")
                print(f"PROMOTED_NISAR_ADDITION_PASS science/nisar-core/{relative_path}: {expected_sha}")
        if label == "Dynamic frontend promotion":
            for relative_path, expected_sha in dynamic_frontend_destination_only.items():
                actual_entry = target_entries.get(f"{destination_prefix}{relative_path}")
                if actual_entry != ("100644", "blob", expected_sha):
                    raise RuntimeError(f"Reviewed frontend destination-only blob changed: {relative_path}")
                print(f"PROMOTED_FRONTEND_ADDITION_PASS apps/web/{relative_path}: {expected_sha}")
        missing = sorted(set(source_view) - set(destination_view))
        extra = sorted(set(destination_view) - set(source_view))
        changed = sorted(
            path
            for path in set(source_view) & set(destination_view)
            if source_view[path] != destination_view[path]
        )
        unapproved_changed: list[str] = []
        for relative_path in changed:
            override_key = f"{label}:{relative_path}"
            override = promotion_overrides.get(override_key)
            if label == "Find Displacements tools promotion" and relative_path in find_tools_changed_blob_pins:
                source_sha, destination_sha = find_tools_changed_blob_pins[relative_path]
                if source_view[relative_path] == ("100644", "blob", source_sha) and destination_view[relative_path] == ("100644", "blob", destination_sha):
                    print(f"PROMOTED_FIND_TOOLS_TRANSFORMATION_PASS engines/find-displacements/tools/{relative_path}: {source_sha} -> {destination_sha}")
                    continue
            if label == "Find Displacements dashboard promotion" and relative_path in find_dashboard_changed_blob_pins:
                source_sha, destination_sha = find_dashboard_changed_blob_pins[relative_path]
                if source_view[relative_path] == ("100644", "blob", source_sha) and destination_view[relative_path] == ("100644", "blob", destination_sha):
                    print(f"PROMOTED_FIND_DASHBOARD_TRANSFORMATION_PASS engines/find-displacements/dashboard/{relative_path}: {source_sha} -> {destination_sha}")
                    continue
            if label == "NISAR science promotion" and relative_path in nisar_science_changed_blob_pins:
                source_sha, destination_sha = nisar_science_changed_blob_pins[relative_path]
                if source_view[relative_path] == ("100644", "blob", source_sha) and destination_view[relative_path] == ("100644", "blob", destination_sha):
                    print(f"PROMOTED_NISAR_TRANSFORMATION_PASS science/nisar-core/{relative_path}: {source_sha} -> {destination_sha}")
                    continue
            if label == "Dynamic active API promotion" and relative_path in dynamic_api_changed_blob_pins:
                source_sha, destination_sha = dynamic_api_changed_blob_pins[relative_path]
                if source_view[relative_path] == ("100644", "blob", source_sha) and destination_view[relative_path] == ("100644", "blob", destination_sha):
                    print(f"PROMOTED_API_TRANSFORMATION_PASS apps/api/{relative_path}: {source_sha} -> {destination_sha}")
                    continue
            if label == "Dynamic frontend promotion" and relative_path in dynamic_frontend_baseline_exceptions:
                print(f"PROMOTED_FRONTEND_BASELINE_PASS apps/web/{relative_path}")
                continue
            if label == "Dynamic frontend promotion" and relative_path in dynamic_frontend_changed_blob_pins:
                source_sha, destination_sha = dynamic_frontend_changed_blob_pins[relative_path]
                if source_view[relative_path] == ("100644", "blob", source_sha) and destination_view[relative_path] == ("100644", "blob", destination_sha):
                    print(f"PROMOTED_FRONTEND_TRANSFORMATION_PASS apps/web/{relative_path}: {source_sha} -> {destination_sha}")
                    continue
            if label == "RiverShift GCOV engine promotion" and relative_path in river_shift_changed_blob_pins:
                source_sha, destination_sha = river_shift_changed_blob_pins[relative_path]
                if source_view[relative_path] == ("100644", "blob", source_sha) and destination_view[relative_path] == ("100644", "blob", destination_sha):
                    print(f"PROMOTED_RIVERSHIFT_FIXTURE_PASS engines/river-shift/tools/river_shift/{relative_path}: {source_sha} -> {destination_sha}")
                    continue
            if label == "Dynamic active API promotion" and relative_path in dynamic_api_baseline_exceptions:
                print(f"PROMOTED_API_BASELINE_PASS apps/api/{relative_path}")
                continue
            if label == "Dynamic shared tools promotion" and relative_path in dynamic_shared_tools_baseline_exceptions:
                print(f"PROMOTED_TOOLS_BASELINE_PASS apps/tools/{relative_path}")
                continue
            if label == "Find Displacements tools promotion" and relative_path in find_tools_baseline_exceptions:
                print(f"PROMOTED_FIND_TOOLS_BASELINE_PASS engines/find-displacements/tools/{relative_path}")
                continue
            if override is None:
                unapproved_changed.append(relative_path)
                continue
            source_entry = source_view[relative_path]
            destination_entry = destination_view[relative_path]
            expected_source = (
                override["mode"], override["object_type"], override["source_blob_sha"]
            )
            expected_destination = (
                override["mode"], override["object_type"], override["destination_blob_sha"]
            )
            if source_entry != expected_source or destination_entry != expected_destination:
                unapproved_changed.append(relative_path)
                continue
            used_promotion_overrides.add(override_key)
            print(
                f"PROMOTED_PATH_OVERRIDE_PASS {override['destination_path']}: "
                f"{override['source_blob_sha']} -> {override['destination_blob_sha']}"
            )
        if missing or extra or unapproved_changed:
            raise RuntimeError(
                f"{label}: source={len(source_view)} destination={len(destination_view)}; "
                f"missing={missing[:10]}; extra={extra[:10]}; "
                f"unapproved_changed={unapproved_changed[:10]}"
            )
        if changed and label not in {
            "Dynamic active API promotion",
            "Dynamic frontend promotion",
            "Dynamic shared tools promotion",
            "Find Displacements tools promotion",
            "RiverShift GCOV engine promotion",
            "NISAR science promotion",
            "Find Displacements dashboard promotion",
        }:
            raise RuntimeError(f"{label}: promotion overrides are not permitted for this source.")
        print(f"PROMOTED_PATH_BLOB_INTEGRITY_PASS {label}: {len(source_view)} entries")

    baseline_override_keys = {
        f"Dynamic active API promotion:{path}" for path in dynamic_api_baseline_exceptions
    }
    unused_overrides = sorted(
        (set(promotion_overrides) - used_promotion_overrides) - baseline_override_keys
    )
    if unused_overrides:
        raise RuntimeError(f"Promotion override manifest contains stale or unapplied entries: {unused_overrides[:10]}")

    promoted_files = (
        (
            "Find Displacements dashboard workflow",
            "migration/source-snapshots/backend-main/.github/workflows/sarguardian-aoi-wkt-dashboard.yml",
            "engines/find-displacements/.github/workflows/sarguardian-aoi-wkt-dashboard.yml",
        ),
        (
            "Find Displacements reusable worker workflow",
            "migration/source-snapshots/backend-main/.github/workflows/sarguardian-aoi-product-worker.yml",
            "engines/find-displacements/.github/workflows/sarguardian-aoi-product-worker.yml",
        ),
        (
            "Find Displacements code-validation workflow",
            "migration/source-snapshots/backend-main/.github/workflows/sarguardian-aoi-code-validation.yml",
            "engines/find-displacements/.github/workflows/sarguardian-aoi-code-validation.yml",
        ),
        (
            "Find Displacements retained artifact smoke test fixture",
            "migration/source-snapshots/backend-main/.github/workflows/dashboard-real-artifact-smoke.yml",
            "engines/find-displacements/.github/workflows/dashboard-real-artifact-smoke.yml",
        ),
        (
            "Find Displacements Known Place AOI dispatcher compatibility fixture",
            "migration/source-snapshots/backend-main/.github/workflows/know-place-aoi-dispatcher.yml",
            "engines/find-displacements/.github/workflows/know-place-aoi-dispatcher.yml",
        ),
        (
            "Find Displacements Known Place paper dispatcher compatibility fixture",
            "migration/source-snapshots/backend-main/.github/workflows/know-place-paper-reproduction-dispatcher.yml",
            "engines/find-displacements/.github/workflows/know-place-paper-reproduction-dispatcher.yml",
        ),
        (
            "Find Displacements AOI WKT dispatcher compatibility fixture",
            "migration/source-snapshots/backend-main/.github/workflows/sarguardian-aoi-wkt-dispatcher.yml",
            "engines/find-displacements/.github/workflows/sarguardian-aoi-wkt-dispatcher.yml",
        ),
        (
            "RiverShift independent-reference validation fixture",
            "migration/source-snapshots/backend-main/.github/workflows/river-shift-independent-reference-validation.yml",
            "engines/river-shift/.github/workflows/river-shift-independent-reference-validation.yml",
        ),
        (
            "Find Displacements retained-artifact smoke workflow fixture",
            "migration/source-snapshots/backend-main/.github/workflows/dashboard-real-artifact-smoke.yml",
            "engines/find-displacements/.github/workflows/dashboard-real-artifact-smoke.yml",
        ),
        (
            "Known Place AOI dispatcher workflow fixture",
            "migration/source-snapshots/backend-main/.github/workflows/know-place-aoi-dispatcher.yml",
            "engines/find-displacements/.github/workflows/know-place-aoi-dispatcher.yml",
        ),
        (
            "Known Place author-exact dispatcher workflow fixture",
            "migration/source-snapshots/backend-main/.github/workflows/know-place-paper-reproduction-dispatcher.yml",
            "engines/find-displacements/.github/workflows/know-place-paper-reproduction-dispatcher.yml",
        ),
        (
            "Find Displacements AOI dispatcher workflow fixture",
            "migration/source-snapshots/backend-main/.github/workflows/sarguardian-aoi-wkt-dispatcher.yml",
            "engines/find-displacements/.github/workflows/sarguardian-aoi-wkt-dispatcher.yml",
        ),
        (
            "RiverShift GCOV workflow fixture",
            "migration/source-snapshots/backend-main/.github/workflows/river-shift-gcov-process.yml",
            "engines/river-shift/.github/workflows/river-shift-gcov-process.yml",
        ),
        (
            "RiverShift independent-reference workflow fixture",
            "migration/source-snapshots/backend-main/.github/workflows/river-shift-independent-reference-validation.yml",
            "engines/river-shift/.github/workflows/river-shift-independent-reference-validation.yml",
        ),
        (
            "Find Displacements development requirements",
            "migration/source-snapshots/backend-main/requirements-dev.txt",
            "engines/find-displacements/requirements-dev.txt",
        ),
        (
            "Find Displacements runtime requirements",
            "migration/source-snapshots/backend-main/requirements.txt",
            "engines/find-displacements/requirements.txt",
        ),
        (
            "Supabase CLI configuration",
            "migration/source-snapshots/dynamic/Backend/supabase/config.toml",
            "infrastructure/supabase/config.toml",
        ),
    )
    for label, source_path, destination_path in promoted_files:
        if source_path not in target_entries or destination_path not in target_entries:
            raise RuntimeError(f"{label}: source or destination file is missing")
        if target_entries[source_path] != target_entries[destination_path]:
            raise RuntimeError(f"{label}: source and destination Git objects differ")
        print(f"PROMOTED_FILE_BLOB_INTEGRITY_PASS {label}")

    alignment_path = Path(__file__).resolve().parents[1] / "migration" / "supabase-history-alignment.json"
    alignment = json.loads(alignment_path.read_text(encoding="utf-8"))
    if alignment.get("schema_version") != 1:
        raise RuntimeError("Supabase history alignment manifest has an unsupported schema.")
    if alignment.get("project_ref") != "qbmhpdprvxssqinnommz":
        raise RuntimeError("Supabase history alignment manifest targets the wrong project.")
    migration_records = alignment.get("records")
    if not isinstance(migration_records, list) or len(migration_records) != 12:
        raise RuntimeError("Supabase history alignment must contain exactly twelve remote migrations.")

    expected_sql_paths: set[str] = set()
    seen_versions: set[str] = set()
    seen_names: set[str] = set()
    for record in migration_records:
        version = str(record.get("remote_version", ""))
        name = str(record.get("remote_name", ""))
        destination_path = str(record.get("destination_path", ""))
        blob_sha = str(record.get("blob_sha", ""))
        if not re.fullmatch(r"[0-9]{14}", version):
            raise RuntimeError(f"Supabase migration has an invalid remote version: {version}")
        if not name or "/" in name or not re.fullmatch(r"[a-zA-Z0-9_]+", name):
            raise RuntimeError(f"Supabase migration has an invalid remote name: {name}")
        if version in seen_versions or name in seen_names:
            raise RuntimeError(f"Supabase migration version/name is duplicated: {version} / {name}")
        seen_versions.add(version)
        seen_names.add(name)
        expected_path = f"infrastructure/supabase/migrations/{version}_{name}.sql"
        if destination_path != expected_path:
            raise RuntimeError(
                f"Supabase migration filename does not match its remote history: {destination_path}; "
                f"expected={expected_path}"
            )
        expected_sql_paths.add(destination_path)
        destination_entry = target_entries.get(destination_path)
        if destination_entry != ("100644", "blob", blob_sha):
            raise RuntimeError(
                f"Supabase migration destination blob mismatch: {destination_path}; "
                f"expected={blob_sha}; actual={destination_entry}"
            )

        source_path = record.get("source_path")
        if source_path:
            source_entry = target_entries.get(str(source_path))
            if source_entry != destination_entry:
                raise RuntimeError(
                    f"Supabase source SQL blob changed while aligning remote filename: "
                    f"{source_path} -> {destination_path}"
                )
        elif record.get("kind") != "monorepo-forward-migration":
            raise RuntimeError(f"Supabase migration lacks source provenance or forward-migration label: {destination_path}")

        print(
            f"SUPABASE_MIGRATION_HISTORY_ALIGNMENT_PASS version={version} "
            f"name={name} blob={blob_sha}"
        )

    actual_sql_paths = {
        path for path in target_entries
        if path.startswith("infrastructure/supabase/migrations/") and path.endswith(".sql")
    }
    if actual_sql_paths != expected_sql_paths:
        raise RuntimeError(
            "Supabase migration directory differs from the twelve-record remote alignment manifest: "
            f"missing={sorted(expected_sql_paths - actual_sql_paths)}; "
            f"extra={sorted(actual_sql_paths - expected_sql_paths)}"
        )
    print(
        f"SUPABASE_REMOTE_HISTORY_FILENAME_ALIGNMENT_PASS "
        f"project={alignment['project_ref']} migrations={len(expected_sql_paths)}"
    )

    for label, ancestor, descendant in ANCESTOR_CHECKS:
        check_ancestor(label, ancestor, descendant)

    print(
        f"ALL_SNAPSHOT_BLOB_INTEGRITY_PASS total_entries={total} "
        f"source_branch_archive_files={archived_branch_files}"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except RuntimeError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
