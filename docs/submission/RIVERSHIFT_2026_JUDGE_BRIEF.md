# RiverShift — NASA Space Apps 2026 Judge Brief

**Recommended first read for the RiverShift workstream.** This brief presents the global AOI-driven proposition, current application experience, processing evidence and the source records that support the Jamuna–Chowhali demonstration.

## The central proposition

**RiverShift is a location-independent, AOI-driven river-change screening workflow powered by NASA–ISRO NISAR L-band GCOV observations.** A user selects a river reach within the global NISAR observation programme and a date window. RiverShift discovers compatible GCOV acquisitions for that request, processes the real observations and displays candidate changes with source provenance.

The Jamuna–Chowhali run is the concrete demonstration case. It is an example of the workflow, not a fixed target polygon or a country restriction.

## Why global applicability is technically grounded

- NASA lists NISAR coverage as global and L-band data acquisitions as global, with a nominal 12-day exact repeat cycle: [NASA Mission Overview](https://science.nasa.gov/mission/nisar/mission-overview/).
- ASF publishes product availability by maturity and acquisition period: [ASF NISAR Data Availability](https://nisar-docs.asf.alaska.edu/availability-overview/).
- RiverShift submits the user's WGS84 polygon and date range to NASA CMR; the catalogue request is not restricted to a Bangladesh-only query: [catalogue discovery implementation](https://github.com/moshiour0/SARGuardian-Monorepo/blob/main/engines/river-shift/tools/river_shift/discover_gcov_products.py).
- AOI and date window are supplied per job: [RiverShift API](https://github.com/moshiour0/SARGuardian-Monorepo/blob/main/apps/api/app/river_shift.py) and [job implementation](https://github.com/moshiour0/SARGuardian-Monorepo/blob/main/apps/api/app/river_shift_jobs.py).

The mission observation plan and public catalogue help users explore the global observation programme. RiverShift then qualifies the actual released products and spatial support for the selected AOI and period.

## Current application experience

The public [shourov-04/SARGuardian application](https://github.com/shourov-04/SARGuardian) has a dedicated RiverShift setup, processing and result journey.

- **Setup:** the user draws/selects an AOI and date window, then chooses general-scan or event-based analysis and the relevant processing settings.
- **Processing:** the job view displays processing stages, AOI/job details, GCOV product counts and processed-product counts, with task controls and result navigation.
- **Results:** the user explores the mapped layers, observed summary, report, real acquisition dates, granule provenance, SHA-256 hashes, spatial QA and uncertainty/sensitivity information.

The application also brings the RiverShift evidence views into a consistent review experience. See the [Application Experience and UI/UX Brief](APPLICATION_UX_BRIEF.md) and [Demonstration Video Brief](VIDEO_PRESENTATION_BRIEF.md).

## Current processing envelope

These are product and quality gates applied to each request:

| Gate | Processing rule |
|---|---|
| AOI geometry | Valid, single-ring WGS84 Polygon |
| AOI size | Maximum 1,000 km² |
| Date window | Maximum 366 days |
| Catalogue support | At least four distinct acquisition dates |
| Spatial product support | At least 90% catalogue-footprint coverage of the AOI per selected date |
| Cross-date compatibility | Compatible orbit/frame, maturity, frequency/covariance term and product configuration |
| Worker verification | Native HDF5 layer, source provenance and valid raster support checked before analysis |
| Series | Up to 12 real acquisition dates; up to four same-date granules per date |

A user selects a manageable river reach. The workflow discovers eligible observations for that place and time window, then processes the compatible acquisition series.

## What the application does

1. **Select:** draw a WGS84 AOI and choose a date window.
2. **Discover:** query the NASA/ASF NISAR GCOV catalogue for that AOI and period.
3. **Qualify:** check distinct dates, footprint, orbit/frame, maturity, frequency/covariance term and layer compatibility.
4. **Process:** retrieve exact GCOV granules, validate provenance and native layers, align valid rasters and calculate screening classes.
5. **Explore:** review actual acquisition dates, checksum-linked reports, separate change layers, preview QA and mapped context.

There is no daily interpolation. Map previews support exploration; full-resolution outputs and their provenance provide the measurement record.

## What the change classes mean

- **Blue:** newly water-covered / observed open-water candidate.
- **Red:** persistent land-to-water transition candidate.
- **Green:** persistent water-to-land transition candidate.

These are explainable screening indicators connected to the source observations.

## Demonstrated evidence

### Current live end-to-end run — Run #25 (12 November 2026)

[Open the successful RiverShift Run #25](https://github.com/shourov-04/SARGuardian/actions/runs/43260188660).

- AOI case: Jamuna–Chowhali demonstration request.
- Request window: 12 November 2025–12 November 2026. NASA CMR returned 68 catalogue candidates; the compatibility/support audit selected 10 exact granules across 10 actual acquisition dates.
- Ten exact NISAR L2 GCOV PROVISIONAL P05023 granules were processed on 18 June, 30 June, 12 July, 24 July, 17 August, 29 August, 10 September, 22 September, 4 October and 16 October 2026.
- All **10/10 first-attempt product worker jobs passed**; the whole workflow completed with 24 successful jobs and 6 intentionally skipped jobs, with no failed jobs.
- Detailed worker logs show authenticated product retrieval, HTTP 206 range support, native HDF5 inspection, requested-layer validation, AOI raster extraction and product-artifact preparation.
- Ten date rasters passed assembly and shared-grid alignment; the 10-product source-provenance manifest passed validation.
- The result manifest validated **72 output entries**. Private result publication passed with 73 publication receipts, followed by successful final assembly and signed callback.

This is an end-to-end processing demonstration for the selected AOI and date window. The live record connects catalogue discovery, authenticated retrieval, native data checks, processing, provenance and result publication.

### Historical retained Jamuna reproducibility case — Run #36

The retained Jamuna case provides an additional reproducibility example. Six actual NISAR GCOV acquisition dates were retained from 30 June to 10 September 2026; source-COG SHA-256 values matched their sidecars in the retrospective replay, and the reported change-area outputs were reproduced. Comparison metrics are published only when the independent source, temporal alignment, data definition and common spatial support meet the matching requirements.

### Code and regression evidence

- [SARGuardian Monorepo](https://github.com/moshiour0/SARGuardian-Monorepo) — application, API, RiverShift engine and NISAR science source.
- [Monorepo Snapshot Regression run 43243267939](https://github.com/moshiour0/SARGuardian-Monorepo/actions/runs/43243267939) — **20/20 jobs passed**, including the promoted RiverShift engine tests (276 passed), archived OPERA reference tests (20 passed) and RiverShift worker tests (259 passed).
- [Full SARGuardian submission pack](SPACE_APPS_2026_FINAL_SUBMISSION_PACK.md) — project story, workflows, run evidence, team contributions and demonstration-video guide.

## Where the rubric evidence lives

| Judging dimension | Evidence to inspect |
|---|---|
| Impact | Global AOI applicability, Jamuna regional example and mapped river-change screening |
| Creativity | User-defined AOI, multi-date radar workflow and separate new-water/erosion/deposition layers |
| Validity | Product manifests, SHA-256 provenance, compatibility/coverage gates, native HDF5 checks and spatial QA |
| Relevance | NISAR L2 GCOV is the primary measurement input for the river-change workflow |
| Presentation | Full HD demonstration video, map-first experience, observed-date exploration and source-aware result panels |
| User experience | AOI drawing, setup controls, processing stages, product counters and dedicated results navigation |
| NASA data usage | NISAR GCOV measurement source and NASA/ASF catalogue discovery |
| Reproducibility | Public source code, automated tests, retained example run and checksummed result records |

## Scientific interpretation

RiverShift keeps the relationship between observation, map class and interpretation explicit:

- Catalogue discovery is followed by spatial, geometry and native-raster qualification.
- Source-mask measurements and simplified display previews have distinct roles.
- Processing and provenance checks are traceable in the result record.
- Independent comparison metrics use matched source, date, data definition and common valid support.
- Playback follows actual acquisition records and does not synthesize daily observations.

## Suggested review path

1. Read this brief for the global AOI-driven proposition and the NISAR GCOV workflow.
2. Review the [4:05 demonstration-video brief](VIDEO_PRESENTATION_BRIEF.md).
3. Follow the [application experience and UI/UX brief](APPLICATION_UX_BRIEF.md) to inspect RiverShift setup, processing and result panels.
4. Open [RiverShift Run #25](https://github.com/shourov-04/SARGuardian/actions/runs/43260188660) for the 10-product processing record.
5. Inspect the [Monorepo RiverShift engine](https://github.com/moshiour0/SARGuardian-Monorepo/tree/main/engines/river-shift/tools/river_shift) and [application API](https://github.com/moshiour0/SARGuardian-Monorepo/tree/main/apps/api).

## Core references

- [NASA NISAR Mission Overview](https://science.nasa.gov/mission/nisar/mission-overview/)
- [NASA NISAR Observation Strategy](https://science.nasa.gov/mission/nisar/observation-strategy/)
- [ASF NISAR Data Availability](https://nisar-docs.asf.alaska.edu/availability-overview/)
- [ASF GCOV Product Guide](https://nisar-docs.asf.alaska.edu/gcov/)
- [NASA CMR Search API](https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html)
