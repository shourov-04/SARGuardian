# RiverShift — NASA Space Apps 2026 judge guide

**Challenge:** Dancing with the SARs  
**Category:** Earth Science  
**Project:** SARGuardian — NISAR-powered surface-change intelligence  
**Live application:** https://sarguardian.vercel.app/  
**Primary repository:** https://github.com/shourov-04/SARGuardian

## One-minute overview

RiverShift is SARGuardian's AOI-driven NISAR L-band GCOV workflow for investigating river and surface-water change. The user selects a river reach and observation window. The application searches the NISAR catalogue for compatible GCOV acquisitions, processes the selected products, and displays source-linked candidate change layers across actual acquisition dates.

The Jamuna–Chowhali area provides a regional demonstration context. The workflow is driven by the user's submitted AOI and date window; the demonstration geography is not hard-coded as the product's only study area.

## Why this matters

Riverbank migration and surface-water transitions can affect settlements, agricultural land, transport routes, and river infrastructure. NISAR radar observations add a repeatable observation source for examining changing river environments. RiverShift connects that data to an accessible workflow: select an AOI, discover compatible observations, process them, and inspect the resulting map layers and provenance.

## What the application does

1. **Select:** draw a WGS84 river-reach polygon and choose a date window.
2. **Discover:** search NASA CMR/ASF for NISAR L-band GCOV acquisitions matching the submitted geometry and dates.
3. **Qualify:** inspect actual acquisition dates, catalogue footprint, orbit/frame, maturity, polarization/frequency, covariance term, and source-layer availability.
4. **Process:** download selected granules, inspect native HDF5 layers, extract AOI rasters, align compatible observations, and calculate the configured screening classes.
5. **Explore:** inspect map overlays, real acquisition-date playback, product identifiers, source manifests, checksums, and quality information.

The application distinguishes catalogue preflight from processing. A catalogue result is not itself a completed analysis.

## Current request model

The request model is defined in the RiverShift API and worker source. It uses a valid WGS84 polygon and a selected observation window, applies the configured AOI/date envelope, then performs catalogue and worker-side compatibility checks. The worker selects actual acquisition dates supported by the available products. It does not synthesize daily measurements.

## Change-layer interpretation

- **Blue — newly water-covered/open-water candidate:** observed water classification under the workflow's comparison rules.
- **Red — persistent land-to-water transition candidate:** used for erosion-oriented screening.
- **Green — persistent water-to-land transition candidate:** used for deposition/land-emergence screening.

The displayed map is designed for spatial exploration. The analytical source rasters and per-product manifest carry the detailed data context.

## Product provenance and QA

RiverShift retains product identifiers, acquisition dates, maturity, configuration, source download receipts, SHA-256 checksums, native HDF5 layer inventories, AOI extraction details, raster alignment information, and the result manifest where emitted by the workflow.

The result review path separates:
- catalogue discovery from product qualification;
- source-raster measurements from display previews;
- processing/provenance QA from scientific interpretation;
- missing reference coverage from a numerical accuracy score.

## Implementation map

| Component | Source location |
|---|---|
| RiverShift worker | `engines/river-shift/tools/river_shift/process_gcov_job.py` |
| Raster and HDF5 validation | `engines/river-shift/tools/river_shift/` |
| Result presentation | `apps/web/src/pages/RiverShiftResultsPage.tsx` |
| Request and job integration | `apps/web/src/api/catalog.ts`, `apps/api/app/river_shift_jobs.py` |
| Workflow automation | `.github/workflows/river-shift-gcov-process.yml` |
| Tests | `engines/river-shift/tools/river_shift/tests/` |

## Primary references

- [NASA NISAR Mission Overview](https://science.nasa.gov/mission/nisar/mission-overview/)
- [NASA NISAR Observation Strategy](https://science.nasa.gov/mission/nisar/observation-strategy/)
- [ASF NISAR Data Availability](https://nisar-docs.asf.alaska.edu/availability-overview/)
- [ASF GCOV Product Guide](https://nisar-docs.asf.alaska.edu/gcov/)
- [NASA CMR Search API](https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html)

## How reviewers can verify it

1. Open the [live application](https://sarguardian.vercel.app/) and choose RiverShift.
2. Select an AOI and date window.
3. Inspect the catalogue response and submit the processing request.
4. Review the resulting overlays, actual acquisition dates, product IDs, manifest, and QA information.
5. Open the [RiverShift engine](https://github.com/shourov-04/SARGuardian/tree/main/engines/river-shift), [workflow source](https://github.com/shourov-04/SARGuardian/tree/main/.github/workflows/river-shift-gcov-process.yml), [tests](https://github.com/shourov-04/SARGuardian/tree/main/engines/river-shift/tools/river_shift/tests), and [Actions history](https://github.com/shourov-04/SARGuardian/actions).

For the cross-project review sequence, see [docs/submission/REVIEWER_GUIDE.md](../../../../docs/submission/REVIEWER_GUIDE.md).
