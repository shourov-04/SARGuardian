# Find Displacements — scientific interpretation and audit boundaries

> **Document status (updated 2026-11-13):** This is a scoped scientific code-review and limitations record. The detailed module-level audit below was first conducted on 2026-10-30. It is not the active workflow configuration and must not be used to infer the current repository's dispatch target or a current deployment state. For the executable workflow map, use the [reviewer guide](../../submission/REVIEWER_GUIDE.md) and [system architecture](../../architecture/system-boundaries.md).

## Current source lineage

- **Active application dispatch:** the root-level `.github/workflows/sarguardian-aoi-wkt-dashboard.yml` dispatches the dashboard engine and per-product worker. The exact active chain is documented in the [reviewer guide](../../submission/REVIEWER_GUIDE.md).
- **GOFF/GUNW reader and discovery source:** the workflow uses the immutable science pin `moshiour0/SARGuardian@006d4cd1485cf80e509eaf8717c12e9c6390ac09`, preserved in this repository under `migration/source-snapshots/nisar-pins/006d4cd/`.
- **Dashboard aggregation source:** the account pipeline checks out `moshiour0/SARGuardian-Monorepo` at the exact `orchestration_sha` recorded in the product manifest and verifies the checked-out SHA. This is a per-run manifest pin, not the retired static Backend aggregator SHA from the earlier audit.
- **Historical audit baseline:** the original module-level review was adapted from [SARGuardian PR #9](https://github.com/moshiour0/SARGuardian/pull/9) and compared against science commit `f038e4dfdb53c8d9793aaaefe173570a1032026c`; the science reader pin above was subsequently checked as a 13-commit delta affecting `src/goff_reader.py`, `src/pixel_stack.py`, `tests/test_detectability.py`, and `tests/test_goff_reader.py`. Historical PR references describe the audit's origin only; they are not current merge or dispatch instructions.

**Detailed module-audit date:** 2026-10-30  
**Scope:** target-free Find Displacements only. Known Place Analysis is a separate target-selected workflow and is outside this audit.

## Latest linked processing evidence

The [Find Displacements example run](https://github.com/shourov-04/SARGuardian/actions/runs/43443025783) completed with 16/16 selected products validated. Its output included 697 spatial candidate features and 27 AOI-wide screening candidates. The workflow explicitly did **not** confirm movement or a hazard, and the common GUNW temporal inversion was withheld because the configured science support gates were not met. This is a per-AOI processing example, not independent validation or a universal performance result.

## Executive finding

The reviewed code path is target-free and produces **exploratory GOFF offset-anomaly candidates**. Separate **relative GUNW LOS diagnostics** are available only where the required support gates pass; the latest linked example withheld common GUNW temporal inversion. These results do not constitute a validated AOI-wide displacement/velocity detector. Dashboard assembly success must not be interpreted as proof that every intermediate scientific raster is exposed as a selectable user-facing map layer; inspect the result manifest and rendered UI for the exact run.

Three distinctions are mandatory:

1. **GOFF offset anomaly is not velocity.** A pairwise range/along-track offset residual, after local background removal, is a spatial screening statistic. It is not a 3-D displacement vector and is not automatically a rate.
2. **GUNW velocity is LOS-only and relative.** A per-pixel GUNW trend is a line-of-sight rate under the selected reference/common-mode policy. It is not downslope, vertical, or 3-D ground velocity.
3. **A candidate is not a hazard detection.** Current GOFF thresholds are exploratory and not calibrated against held-out positive and correlated-noise null datasets.

## Exact Find Displacements execution map

| Component | Find Displacements status | Actual role |
|---|---|---|
| `aoi_wkt.py` | Executed before product work (through discovery) | Validates and normalizes the user WGS84 polygon. |
| `gunw_reader.py` | Executed for every selected GUNW | Converts unwrapped phase to relative LOS displacement; quality masks, ionosphere screen and auto-reference. |
| `goff_reader.py` | Executed for every selected GOFF | Exports layer-2 range/along-track offsets and quality layers. |
| Backend `aoi_wide_displacement_screen.py` | Executed in AOI aggregation | Target-free GOFF spatial anomaly screen and pair-persistence candidates. |
| `pixel_stack.py` | Executed in diagnostics when compatible PR GUNW exports exist | Per-pixel relative GUNW LOS-rate diagnostic; default common-mode-removed and retained sensitivity runs. |
| `timeseries.py` | Network/topology module is imported only inside target-gated common-reference branch | Graph inversion semantics; no target-free common-datum series is currently published. |
| `common_ref.py` | Withheld in Find Displacements because its helper requires target locations | Common support outside target buffers; not a target-free stable-ground solution. |
| `local_floor.py` | `NOT_RUN_NO_IN_AOI_TARGET` in target-free mode | Point/window noise floor; retain for Known Place Analysis. |
| `candidate_check.py` | `SKIPPED_UNSUPPORTED_CUSTOM_AOI` | Named-AOI, target-centred event-prior stress test; not a generic WKT detector. |
| `inverse_velocity.py` | Withheld | Requires a defensible measured series and matching noise floor. |
| `geometry_merge.py` | Withheld | Requires comparable, geometry-aware series; no generic AOI 3-D inversion is currently done. |
| `bound.py` | `NOT_APPLICABLE_GENERIC_AOI` | Fixed event/candidate assumptions; not valid for arbitrary user AOI. |

Do not change a target-gated module into a centroid-based substitute. A centroid is not a measured target and must never silently enter this workflow.

## Main scientific gaps before claiming robust AOI-wide velocity

- **GOFF uncertainty:** the reader uses correlation and SNR gates, but the AOI screen does not ingest the per-pixel offset variance/covariance. Its pair threshold uses a range-derived floor for a two-component offset magnitude; the azimuth uncertainty is therefore not independently represented.
- **GOFF resolution:** the worker currently selects `layer2` only. NISAR GOFF carries multiple offset layers/resolutions; multi-resolution consistency/sensitivity has not been demonstrated for this detector.
- **Spatial scale:** the 41-pixel local background subtraction suppresses broad or slowly varying AOI-scale motion. Sensitivity to feature size and to the detrending window needs injection tests.
- **Temporal support:** two compatible pair hits are enough for an exploratory persistence candidate, but not a redundant displacement time-series network or independent velocity validation.
- **GUNW datum/atmosphere:** GUNW pair auto-reference is not by itself a common stable datum across pairs. External tropospheric corrections are not applied by default in the NISAR product. The target-free common-reference route is currently withheld.
- **Presentation:** the 2026-10-30 module audit did not establish that every AOI screening raster (for example, support counts, persistent masks, coherence, or GUNW diagnostics) is available as a selectable user-facing map overlay. Confirm the exact artifact manifest and UI layer list for each run before claiming that an intermediate raster is directly viewable.
- **Validation:** synthetic/unit tests prove code invariants; no held-out positive and null scenes or independent field/GNSS validation establish operational sensitivity, precision, or false-alarm rate.

## Required release gates

1. Preserve immutable source identity and exact AOI/date hashes.
2. Keep GOFF and GUNW measurements separate, including units and uncertainty.
3. Add component-specific GOFF uncertainty and multi-resolution checks before calling candidate velocity.
4. Design a target-free GUNW stable-reference strategy with independently assessable stability; retain reference sensitivity diagnostics.
5. Calibrate spatial/temporal thresholds with injected known motion and spatially correlated nulls, using held-out AOIs and event periods.
6. Publish georeferenced candidate masks, support counts, uncertainty, and GUNW LOS velocity/sigma layers to the viewer; do not render missing support as zero.
7. Do not report 3-D/down-slope velocity without an adequately conditioned geometry inversion and propagated covariance.
8. Keep all unresolved/insufficient-support outcomes visible.

## Script reports

- [aoi_wkt.py](aoi_wkt.md)
- [gunw_reader.py](gunw_reader.md)
- [goff_reader.py](goff_reader.md)
- [pixel_stack.py](pixel_stack.md)
- [timeseries.py](timeseries.md)
- [common_ref.py](common_ref.md)
- [local_floor.py](local_floor.md)
- [candidate_check.py](candidate_check.md)
- [inverse_velocity.py](inverse_velocity.md)
- [geometry_merge.py](geometry_merge.md)
- [bound.py](bound.md)

## External scientific references

- ASF/NISAR [GOFF product guide](https://nisar-docs.asf.alaska.edu/goff/): 80 m geocoded offset product, pairwise pixel offsets, multiple layers with bandwidth-dependent sampling, unfiltered output can contain outliers.
- ASF/NISAR [GUNW product guide](https://nisar-docs.asf.alaska.edu/gunw/): 80 m geocoded unwrapped phase, coherence, connected components and ionosphere screen; ionosphere screen is included but not applied by default, and available external phase-correction layers (including troposphere) are not removed by default.
- Berardino et al. (2002), [SBAS InSAR](https://doi.org/10.1109/TGRS.2002.803792): small-baseline interferogram networks and SVD linking; a connected/redundant graph and atmospheric considerations matter for temporal deformation estimation.
- Kääb & Wouters et al. (2022), [Correlation dispersion as a measure to better estimate uncertainty in remotely sensed glacier displacements](https://tc.copernicus.org/articles/16/2285/2022/): matching precision varies spatially and correlation-peak dispersion is useful as a per-measurement uncertainty proxy.
- Wright, Parsons & Lu (2004), [Toward mapping surface deformation in three dimensions using InSAR](https://doi.org/10.1029/2003GL018827): one interferogram measures LOS only; near-polar satellite geometry weakly resolves north motion even with multiple looks.
- Fukuzono (1985), [Inverse velocity method](https://doi.org/10.3313/jls1964.22.2_8): derived from controlled slope-model failure experiments; it is not a general AOI discovery method or an unconditional forecast.

**Evidence level:** dated source-code review + repository regression-test inventory + literature/documentation comparison, supplemented by the linked 2026-11-13 processing-run summary. The example run is real processing evidence for its AOI and inputs, but it is not an independent geophysical validation dataset or a measurement of detector sensitivity/precision/false-alarm rate.
