from __future__ import annotations

import hashlib
import json
from datetime import date
from pathlib import Path

import pytest

from science_adapter import catalog
from science_adapter.geometry import processing_fingerprint, validate_wkt
from science_adapter.run_displacement import AdapterError, _download_with_retry, cleanup_after_verified_storage
from science_adapter.validation import enforce_retention_aoi_mask, inventory_hdf5


WKT = "POLYGON((85 27, 85.01 27, 85 27.01, 85 27))"
NAME = "NISAR_L2_PR_GUNW_032_098_A_015_033_4000_SH_20261001T000000_20261001T000100_20261013T000000_20261013T000100_P05023_N_F_J_001"


def test_aoi_contract_requires_closure_topology_and_canonical_fingerprint() -> None:
    first = validate_wkt(WKT)
    reversed_ring = validate_wkt("POLYGON((85 27, 85 27.01, 85.01 27, 85 27))")
    assert first.sha256 == reversed_ring.sha256
    assert processing_fingerprint(aoi_wkt=WKT, start_date="2026-10-01", end_date="2026-10-22") == processing_fingerprint(
        aoi_wkt="POLYGON((85 27,85 27.01,85.01 27,85 27))", start_date="2026-10-01", end_date="2026-10-22")
    with pytest.raises(ValueError, match="closed"):
        validate_wkt("POLYGON((85 27, 85.01 27, 85 27.01))")
    with pytest.raises(ValueError, match="self-intersect"):
        validate_wkt("POLYGON((85 27, 85.01 27.01, 85.01 27, 85 27.01, 85 27))")


def test_catalog_identity_date_policy_and_variant_release_selection() -> None:
    identity = catalog.parse_identity(NAME)
    assert identity["reference"] == date(2026, 10, 1)
    assert identity["secondary"] == date(2026, 10, 13)
    assert identity["crid_maturity"] == "PROVISIONAL"
    assert catalog.in_window(identity, date(2026, 10, 2), date(2026, 10, 13), catalog.SECONDARY)
    assert not catalog.in_window(identity, date(2026, 10, 2), date(2026, 10, 13), catalog.BOTH)
    older = identity | {"granule": NAME.replace("P05023", "P05022"), "crid": "P05022", "maturity": "BETA"}
    newer = identity | {"maturity": "PROVISIONAL"}
    selected, excluded = catalog.deduplicate([older, newer])
    assert [item["granule"] for item in selected] == [NAME]
    assert excluded[0]["reason"] == "SUPERSEDED_PROCESSING_RELEASE"


def test_catalog_identity_supplies_the_pinned_downloader_contract() -> None:
    identity = catalog.parse_identity(NAME)
    # The upstream downloader logs this legacy ``path`` field before calling
    # ASF.  A dynamic record must carry it as well as the clearer ``track``.
    assert identity["path"] == identity["track"] == "098"


def test_catalog_rejects_incomplete_result_sets() -> None:
    with pytest.raises(catalog.CatalogError, match="cap"):
        catalog.normalize_payload([{}] * catalog.CATALOG_LIMIT)
    with pytest.raises(catalog.CatalogError, match="paginated"):
        catalog.normalize_payload({"results": [], "nextPageToken": "more"})


def test_retained_raster_removes_values_outside_the_custom_polygon(tmp_path: Path) -> None:
    import numpy as np
    import rasterio
    from rasterio.transform import Affine

    path = tmp_path / "aoi-window.tif"
    with rasterio.open(path, "w", driver="GTiff", height=2, width=2, count=1,
                       dtype="float32", crs="EPSG:4326", transform=Affine(.5, 0, 0, 0, -.5, 1), nodata=np.nan) as dst:
        dst.write(np.ones((1, 2, 2), dtype="float32"))
    receipt = enforce_retention_aoi_mask(path, "POLYGON((0 0, .6 0, 0 .6, 0 0))")
    with rasterio.open(path) as src:
        data = src.read(1)
        assert int(np.isfinite(data).sum()) == 1
        assert src.tags()["retention_aoi_mask_enforced"] == "true"
    assert receipt == {"status": "PASS", "removed_finite_values": 3, "valid_pixels": 1}


def test_hdf5_inventory_records_named_datatypes_without_treating_them_as_datasets(tmp_path: Path) -> None:
    import h5py
    import numpy as np

    raw = tmp_path / f"{NAME}.h5"
    with h5py.File(raw, "w") as h5:
        h5.require_group("science/LSAR/GUNW").create_dataset("unwrappedPhase", data=np.zeros((2, 2), dtype="float32"))
        h5["committedStringType"] = h5py.string_dtype(encoding="utf-8")
    result = inventory_hdf5(raw, {"granule": NAME, "productType": "GUNW", "reference": date(2026, 10, 1), "secondary": date(2026, 10, 13)})
    assert result["status"] == "PASS"
    assert result["named_datatypes"][0]["path"] == "/committedStringType"


def test_primary_account_dispatch_uses_the_root_find_displacements_pipeline() -> None:
    root = Path(__file__).resolve().parents[3]
    dispatcher = (root / ".github" / "workflows" / "sarguardian-aoi-wkt-dashboard.yml").read_text(encoding="utf-8")
    dashboard = (root / ".github" / "workflows" / "sarguardian-aoi-dashboard-engine.yml").read_text(encoding="utf-8")
    worker = (root / ".github" / "workflows" / "sarguardian-aoi-product-worker.yml").read_text(encoding="utf-8")
    target_tool = (root / "engines" / "find-displacements" / "tools" / "measure_target_from_raster.py").read_text(encoding="utf-8")
    uploader = (root / "apps" / "tools" / "drive_resumable_upload.py").read_text(encoding="utf-8")

    # The API dispatches the declared account contract directly to the only
    # root-level runnable workflow; no nested Dynamic workflow is used.
    assert "workflow_dispatch:" in dispatcher
    assert "uses: ./.github/workflows/sarguardian-aoi-dashboard-engine.yml" in dispatcher
    for name in (
        "aoi_wkt", "start_date", "end_date", "date_filter_mode", "run_profile",
        "retention_profile", "job_id", "callback_url", "request_fingerprint",
        "place_name", "target_latitude", "target_longitude",
    ):
        assert f"      {name}:" in dispatcher
        assert f"{name}: " + "${{ inputs." + name + " }}" in dispatcher
    assert "MONOREPO_DISPLACEMENT_ACTIONS_ENABLED" in dispatcher
    assert "MONOREPO_DISPLACEMENT_PROCESSING_GATE=PASS" in dispatcher

    # The reusable engine performs bounded per-product work, receipt-based
    # retries and dashboard assembly from the exact orchestration revision.
    assert "python engines/find-displacements/tools/discover_aoi_products.py" in dashboard
    assert "uses: ./.github/workflows/sarguardian-aoi-product-worker.yml" in dashboard
    assert re.search(r"(?m)^      max-parallel: 15$", dashboard)
    assert "retry-plan:" in dashboard
    assert "retry-products:" in dashboard
    assert "retry_count != '0'" in dashboard
    assert "python dashboard-source/engines/find-displacements/tools/aggregate_aoi_run.py" in dashboard
    assert "repository: moshiour0/SARGuardian-Monorepo" in dashboard
    assert "ref: " + "${{ needs.manifest.outputs.orchestration_sha }}" in dashboard
    assert 'test "$actual" = "' + "${EXPECTED_DASHBOARD_SHA:?}" + '"' in dashboard
    assert "SITE_TARGET_LATITUDE: " + "${{ inputs.target_latitude }}" in dashboard

    # Product diagnostics use the pinned science snapshot, preserve
    # no-valid-pixel as no measurement, and gate cleanup on verified retention.
    assert "SCIENCE_COMMIT: 006d4cd1485cf80e509eaf8717c12e9c6390ac09" in worker
    assert "src/gunw_reader.py" in worker and "src/goff_reader.py" in worker
    assert "id: target_measurement" in worker
    assert "id: local_floor" in worker
    assert "write_no_valid_pixel_stats.py" in worker
    assert "NO VALID PIXELS" in worker
    assert "measure_target_from_raster.py" in worker
    assert '--aoi-wkt "$SARGUARDIAN_AOI_WKT"' in worker
    assert "--minimum-valid-pixels 6" in worker
    assert "Delete local raw/archive only after successful remote retention" in worker
    assert "ERROR=REFUSING_RAW_DELETION_WITHOUT_REMOTE_VERIFICATION" in worker
    assert "REMOTE_DERIVED_OUTPUTS_AND_RETENTION_POLICY_VERIFIED=PASS" in worker
    assert "REMOTE_RETENTION_FOLDER_ID_MISMATCH" in worker
    assert "runner_raw_hdf5_deleted" in worker
    assert "def parse_aoi_wkt_ring" in target_tool
    assert "REMOTE_FOLDER_ID=" not in uploader



def test_cleanup_never_deletes_raw_without_complete_remote_receipts(tmp_path: Path) -> None:
    science_root = tmp_path / "science"
    raw = science_root / "data" / "nisar_l2" / "_incoming" / (NAME + ".h5")
    raw.parent.mkdir(parents=True)
    raw.write_bytes(b"raw-HDF5-bytes")
    work = tmp_path / "work"
    work.mkdir()
    output = work / "outputs" / "x" / "result.tif"
    output.parent.mkdir(parents=True)
    output.write_bytes(b"derived")
    artifact = {"path": "outputs/x/result.tif", "sha256": hashlib.sha256(output.read_bytes()).hexdigest(), "bytes": output.stat().st_size}
    manifest = {"storage_verification": {"status": "PASS"}, "validated_outputs": [artifact],
                "cleanup": {"raw_files": [{"raw_path": str(raw), "sha256": hashlib.sha256(raw.read_bytes()).hexdigest(), "bytes": raw.stat().st_size}]}}
    (work / "result-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    with pytest.raises(AdapterError, match="remote verification"):
        cleanup_after_verified_storage(work, science_root)
    assert raw.exists()
    artifact.update({"drive_file_id": "abcdefghijk", "remote_verification": {"status": "PASS"}})
    (work / "result-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    completed = cleanup_after_verified_storage(work, science_root)
    assert not raw.exists()
    assert completed["cleanup"]["status"] == "PASS"



def test_raw_product_download_is_single_attempt_and_partial_file_is_removed(tmp_path: Path) -> None:
    class InterruptedDownload:
        calls = 0

        def download(self, product_types: list[str], records: list[dict[str, object]]) -> None:
            self.calls += 1
            raw.write_bytes(b"partial-product")
            raise OSError("simulated transient network error")

    raw = tmp_path / "one-granule.h5"
    acquisition = InterruptedDownload()
    record = {
        "productType": "GUNW",
        "granule": "test-granule",
        "url": "https://example.invalid/granule.h5",
        "direction": "ASCENDING",
        "path": "098",
        "reference": "2026-01-01",
        "secondary": "2026-01-13",
    }

    with pytest.raises(AdapterError, match="one bounded attempt"):
        _download_with_retry(acquisition, record, raw, tmp_path)

    assert acquisition.calls == 1
    assert not raw.exists()
