# SARGuardian
### NISAR-Powered Surface Change Intelligence
**NASA Space Apps Challenge 2026 · Dancing with the SARs · Earth Science**

SARGuardian brings NISAR-based surface-change exploration into one interactive application. Choose an area of interest (AOI) and observation period, discover compatible satellite products, start the relevant processing workflow, and inspect maps, measurements, acquisition information, and provenance.

## Open the project

**Live application:** https://sarguardian.vercel.app/

**Primary public submission repository:** https://github.com/shourov-04/SARGuardian

**GitHub Actions — processing and validation history:** https://github.com/shourov-04/SARGuardian/actions

Reviewers are invited to use the live application, select their own AOI and observation window, and explore the available analysis workflows. The repository contains the web application, API implementation, product-specific processing engines, automated workflows, tests, reviewer documentation, and a supplementary reproducible NISAR detectability study.

## What SARGuardian does

| Workflow | What users investigate | Main NISAR product family |
|---|---|---|
| **Find Displacements** | Target-free, AOI-wide screening for candidate surface-displacement signals | GOFF offsets, with separate GUNW phase/LOS diagnostics |
| **Glacier Movement** | Candidate surface-change and movement signals across glacier terrain | Shared displacement workflow using GOFF and available GUNW diagnostics |
| **Known Place Analysis** | Focused analysis with separate Measurement and Reference Polygons | Compatible GOFF observations and the dedicated author-exact research path |
| **RiverShift** | Multi-date river and water/land transition screening | GCOV covariance/backscatter observations |

### From an AOI to inspectable results

1. **Select an area.** Search for a place or draw the AOI on the map.
2. **Choose an observation window.** Specify the dates relevant to the investigation.
3. **Discover available NISAR products.** Catalogue preflight identifies products and acquisition metadata compatible with the request.
4. **Run the workflow.** The authenticated application/API coordinates the selected processing job and its GitHub Actions worker.
5. **Review the result.** Inspect spatial layers, actual acquisition dates, source identifiers, quality information, and processing provenance.

Catalogue preflight and scientific processing are separate stages: a catalogue match identifies candidate source products; the processing worker performs product-level checks and analysis.

## The scientific core

SARGuardian keeps the three NISAR evidence families distinct:

- **GOFF — Geocoded Pixel Offsets:** along-track and slant-range pixel-offset observations used for spatial displacement screening.
- **GUNW — Geocoded Unwrapped Interferogram:** interferometric phase observations used for pairwise Line-of-Sight (LOS) diagnostics where valid support is available.
- **GCOV — Geocoded Polarimetric Covariance:** radar covariance/backscatter observations used by RiverShift to screen water and persistent land–water transitions.

The workflows preserve product identity, acquisition dates, processing maturity, geometry, usable-pixel support, and source provenance. The application presents actual acquisition observations rather than manufacturing missing dates.

## Scientific interpretation

SARGuardian is built around **evidence before interpretation**:

- GOFF anomalies are candidate signals for investigation, not automatic confirmation of a landslide or ground movement.
- GUNW pairwise LOS observations are presented separately from GOFF offsets; they are not automatically cumulative or three-dimensional displacement.
- RiverShift colours identify satellite-derived screening classes, not field-confirmed erosion, deposition, damage, or sediment volume.
- A processing or structural/provenance PASS reports the checks performed by the workflow; it is not an independent geophysical accuracy score.
- Playback follows observed acquisition dates. A missing measurement is not treated as zero.

These distinctions make the outputs easier to interpret, compare, and review.

## Processing architecture

The web application is in `apps/web/`; the FastAPI API implementation and request adapters are in `apps/api/`. Runtime scientific processing components are organised under `engines/` and their workflow-specific tools. GitHub Actions workflows coordinate product workers, automated checks, provenance handling, result assembly, and delivery. The separate `science/nisar-core/` directory contains a reproducible NISAR detectability research study; it is supplementary scientific context, not a runtime dependency of the four application workflows.

The account Find Displacements processing chain is dispatched through [the root AOI dispatcher](.github/workflows/sarguardian-aoi-wkt-dashboard.yml), which calls the [dashboard engine](.github/workflows/sarguardian-aoi-dashboard-engine.yml) and the [per-product worker](.github/workflows/sarguardian-aoi-product-worker.yml). Glacier Movement uses that same displacement chain. Known Place and RiverShift have their own root-level workflow entry points documented in the [reviewer guide](docs/submission/REVIEWER_GUIDE.md).

Useful implementation locations:

- [Web application](apps/web/)
- [API implementation](apps/api/)
- [Find Displacements engine](engines/find-displacements/)
- [Known Place engine](engines/known-place/)
- [RiverShift engine](engines/river-shift/)
- [Supplementary NISAR detectability research](science/nisar-core/)
- [GitHub Actions workflows](.github/workflows/)
- [Automated tests and validation suites](engines/)

## Start here for review

The documentation is organised so that a human reviewer or AI-assisted reviewer can follow the same source-first path:

1. [Project overview](docs/submission/PROJECT_OVERVIEW.md)
2. [Reviewer guide — run the application and inspect the code](docs/submission/REVIEWER_GUIDE.md)
3. [Datasets and official references](docs/submission/DATASETS_AND_REFERENCES.md)
4. [Scientific methods and interpretation](docs/submission/SCIENTIFIC_METHODS.md)
5. [AI usage disclosure](docs/submission/AI_USAGE.md)
6. [Score-sheet evidence matrix](docs/submission/score-sheet-evidence-matrix.md)
7. [Documentation index](docs/README.md)

## Team

| Team member | Contribution |
|---|---|
| **Moshiur Rahman Sarker — Team Lead** | Scientific Core Engine and processing development; project development and integration; coordination; video editing. Department of Mathematics, Ananda Mohan College, Mymensingh, Bangladesh. |
| **Sagor Chandra Modak** | Scientific Core Engine implementation through GitHub Actions; UI/UX design; final project refinement and Scientific Validation. CSE, Shahjalal University of Science and Technology, Bangladesh. |
| **MD Fahim** | RiverShift development and video editing. CSE, Islamic University, Kushtia, Bangladesh. |
| **Tasmia Binte Hasan** | Project storytelling and presentation. |

For fuller role descriptions and contribution evidence, see [Team & Contributions](docs/submission/TEAM_AND_CONTRIBUTIONS.md).

[View live contributor activity](https://github.com/shourov-04/SARGuardian/graphs/contributors) · [View commit history](https://github.com/shourov-04/SARGuardian/commits/main)

## Project history

The current repository consolidates the team's application, processing, and scientific work into one public-facing codebase. Dated source-lineage and migration records are preserved under [docs/migration/](docs/migration/); the current product, workflows, and review path are described in the documents linked above.

---

**SARGuardian — explore real NISAR observations, run an analysis, and investigate a changing Earth.**
