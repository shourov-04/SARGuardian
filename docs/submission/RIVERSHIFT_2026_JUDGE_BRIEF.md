# RiverShift — NASA Space Apps 2026 Judge Brief

**Recommended first read for the RiverShift workstream.** This brief presents the global AOI-driven proposition, current application experience, processing architecture and the source code behind the Jamuna–Chowhali demonstration.

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

The live [SARGuardian application](https://sar-guardian-monorepo-web.vercel.app/) has a dedicated RiverShift setup, processing and result journey. Reviewers are invited to open it and explore the workflow using a location and observation window of their choice.

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

## Live review and processing architecture

The most useful way to validate RiverShift is to use the live application rather than rely on one frozen processing run. Reviewers are invited to open [SARGuardian](https://sar-guardian-monorepo-web.vercel.app/), define a river-reach AOI and observation window, and explore the available setup, processing and results views.

Where the account has processing access and the selected AOI/date window has compatible released NISAR GCOV observations, submit a fresh request. The application connects that request to an actual GitHub Actions workflow execution and displays the resulting job and evidence context.

**GitHub Actions is a core part of the Scientific Core Engine execution architecture.** The workflow layer coordinates NASA CMR/ASF catalogue discovery, exact-granule selection, product workers, native HDF5/layer validation, the RiverShift processing engine, result assembly, provenance verification and artifact delivery. The processing algorithms are implemented in the repository's RiverShift engine code; workflow YAML provides repeatable orchestration and job execution.

Review the implementation directly:

- [Live SARGuardian application](https://sar-guardian-monorepo-web.vercel.app/)
- [Public SARGuardian repository](https://github.com/shourov-04/SARGuardian)
- [GitHub Actions workflows](https://github.com/shourov-04/SARGuardian/tree/main/.github/workflows)
- [RiverShift processing engine](https://github.com/shourov-04/SARGuardian/tree/main/engines/river-shift)
- [Monorepo source and API history](https://github.com/moshiour0/SARGuardian-Monorepo)

A fresh run is tied to the request actually submitted. This avoids presenting one selected historical run as a permanent or exhaustive validation of a continuously evolving application.

## Where the rubric evidence lives

| Judging dimension | What a reviewer can inspect live |
|---|---|
| Impact | User-selected river reaches, AOI/date exploration and mapped river-change screening |
| Creativity | AOI-driven multi-date radar workflow with separate new-water, erosion-screening and deposition-screening layers |
| Validity | Compatible product selection, acquisition dates, native data checks, source manifests, checksums, spatial support and QA visible through the job and result experience |
| Relevance | NISAR L2 GCOV as the primary measurement input, with NASA CMR/ASF discovery |
| Presentation | Full HD demonstration video, map-first experience and source-aware result panels |
| User experience | AOI drawing, setup controls, processing stages, product counters and dedicated results navigation |
| NASA data usage | NISAR GCOV measurement source and NASA/ASF catalogue discovery |
| Reproducibility | Public source code, versioned workflows and a fresh request-specific execution record |

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
4. Use the live application to submit a fresh AOI/date-window request where compatible products are available.
5. Inspect the [GitHub Actions workflows](https://github.com/shourov-04/SARGuardian/tree/main/.github/workflows) and [RiverShift engine](https://github.com/shourov-04/SARGuardian/tree/main/engines/river-shift).

## Core references

- [NASA NISAR Mission Overview](https://science.nasa.gov/mission/nisar/mission-overview/)
- [NASA NISAR Observation Strategy](https://science.nasa.gov/mission/nisar/observation-strategy/)
- [ASF NISAR Data Availability](https://nisar-docs.asf.alaska.edu/availability-overview/)
- [ASF GCOV Product Guide](https://nisar-docs.asf.alaska.edu/gcov/)
- [NASA CMR Search API](https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html)
