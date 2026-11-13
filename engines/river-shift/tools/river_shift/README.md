# RiverShift — NISAR GCOV processing engine

RiverShift is SARGuardian's AOI-driven river and surface-water change workflow. It uses compatible NISAR L-band Level-2 GCOV observations to screen observed water coverage and persistent land–water transitions for a user-selected river reach.

## User workflow

1. Select a WGS84 river-reach polygon and observation window in the SARGuardian application.
2. Run catalogue discovery for NISAR GCOV products intersecting the AOI and dates.
3. Qualify candidate acquisitions using product metadata and spatial/temporal compatibility.
4. Process the selected granules, inspect native HDF5 layers, extract AOI rasters, align comparable observations, and derive the configured screening layers.
5. Review actual acquisition dates, map overlays, result manifests, source granule hashes, and QA information in the application.

The worker uses the submitted AOI and date window. It does not substitute a fixed Jamuna polygon or generate daily interpolated observations.

## Screening layers

- **Blue:** newly water-covered/open-water candidate.
- **Red:** persistent land-to-water transition candidate used for erosion-oriented screening.
- **Green:** persistent water-to-land transition candidate used for deposition/land-emergence screening.

These are radar-derived screening classes. The map preview is a display product; source rasters and their manifests remain the reference for analysis.

## Processing and provenance

The worker source is in this directory, including `process_gcov_job.py`, raster readers, catalogue helpers, overlap QA, validation helpers, and result packaging. The related workflow is [river-shift-gcov-process.yml](../../../../.github/workflows/river-shift-gcov-process.yml) and the other RiverShift checks are listed under the same workflow directory.

Each accepted granule is tied to its download receipt, source-product SHA-256, HDF5 layer inventory, and processing context. The worker validates that the required GCOV frequency/term is present before raster processing. It uses actual selected acquisition dates and retains product identity in the result manifest.

## Request envelope in the application

The current request contract is defined by the web/API request models and this worker's validation code. It accepts a valid WGS84 polygon and date range within the configured area and time bounds, then applies catalogue and worker-side compatibility checks. The worker selects only actual compatible acquisition dates; a request is not converted into synthetic daily observations.

## Development

Install Python dependencies from this directory using `requirements.txt`. GDAL is a native dependency and must be installed with HDF5 support. Targeted tests are in `tests/`.

## Reviewer links

- [Live SARGuardian application](https://sarguardian.vercel.app/)
- [Primary source repository](https://github.com/shourov-04/SARGuardian)
- [GitHub Actions history](https://github.com/shourov-04/SARGuardian/actions)
- [RiverShift judge brief](NASA_SPACE_APPS_2026_JUDGE_BRIEF.md)
- [RiverShift judge guide](NASA_SPACE_APPS_2026_JUDGE_GUIDE.md)
- [Datasets and references](../../../../docs/submission/DATASETS_AND_REFERENCES.md)
