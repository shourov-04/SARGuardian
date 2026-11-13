# SARGuardian — Application Experience and UI/UX Brief

**Implementation repository:** [shourov-04/SARGuardian](https://github.com/shourov-04/SARGuardian)  
**Reviewed branch:** main  
**Reviewed source snapshot:** eb5e7e4790847789daf426df5328ead2c8674398  
**Review date:** 13 November 2026  
**Repository relationship:** GitHub identifies this repository as a fork of [moshiour0/SARGuardian-Monorepo](https://github.com/moshiour0/SARGuardian-Monorepo).

## Experience overview

The application organises the user journey around a clear progression: choose an investigation, define a place and observation window, discover eligible NISAR products, follow processing progress and review the resulting evidence.

The current interface combines a project-led home page, a guided “How it works” explanation, staged processing views, focused Known Place controls and a dedicated RiverShift result experience.

## 1. Home and guided orientation

The home page introduces SARGuardian and presents its primary investigation entry points, including Find Displacement, Known Place Analysis and River Shift. The workflow catalogue separately defines Glacier Movement as a user-facing category that uses the shared AOI-wide displacement workflow.

The “How it works” page organises the product into four steps:

1. **Choose an area:** search for a place or draw an AOI, then choose dates.
2. **Check what exists:** search the NISAR archive for matching products before processing.
3. **Process and screen:** follow processing, quality checks and candidate screening.
4. **Review the evidence:** explore maps, measurements, source records and interpretation context.

## 2. Find Displacements and Glacier Movement

The displacement processing view presents explicit stages—Initializing, Processing, Screening and Complete—and separate counters for GUNW, GOFF and total products.

The task view keeps the submitted area, date window, AOI-wide scope and job identifier visible. It supports task management and result navigation, including cancel, retry where available and Show result.

Glacier Movement is a workflow category using the shared AOI-wide displacement core. The product keeps the underlying GOFF and GUNW evidence families distinct.

## 3. Known Place Analysis

The Known Place interface supports separate Measurement and Reference polygons and accepts a suggested Measurement Polygon transferred from a selected Find Displacements GOFF candidate. This creates a direct user journey from broad candidate discovery to focused analysis.

The analysis controls include:

- Hazard context: Landslide, Glacier collapse, Ice–rock avalanche, or Mixed / uncertain.
- Analysis mode: Exploratory measurement or Retrospective validation.
- Polarization, track and flight direction.
- Minimum valid coherence-neighbour setting.
- Optional geometry-height sensitivity setting.
- Catalogue release lookup, release selection and processing-variant selection.
- Run progress and result navigation.

## 4. RiverShift processing experience

RiverShift has a dedicated setup and processing flow for NISAR L2 GCOV observations. The processing view presents job stages, AOI and job details, GCOV product counts and processed-product counts, together with task controls and result navigation.

Its additional settings expose the main analysis choices:

- General River Change Scan or Event-Based Analysis.
- Processing maturity, polarization and orbit direction.
- NISAR frame-coverage selection.
- Science frequency and diagonal covariance term.
- Common Otsu or manual water-threshold method.

## 5. RiverShift result exploration

The result experience provides a dedicated map and evidence-review layout. Its main elements include:

- Separate new-water, persistent-erosion and persistent-deposition candidate layers.
- Observed-date exploration and playback based on acquisition records.
- An observed summary and scientific report.
- Source-granule provenance, product identity and SHA-256 integrity hashes.
- Full-resolution source-mask and display-preview overlap diagnostics.
- Uncertainty and sensitivity details.
- Scientific-readiness and interpretation panels.

The map supports visual exploration while the underlying reports and provenance retain the traceable evidence for each result.

## 6. Evidence-led interface design

Across workflows, the interface connects the user's geographic question to a reviewable set of observations and outputs. Processing stages, product counts, acquisition dates, provenance and quality review are part of the user journey.

The product distinguishes the roles of its principal NISAR inputs:

- **GOFF:** range/azimuth offset diagnostics for candidate screening.
- **GUNW:** interferometric phase and line-of-sight diagnostics where the processing gates pass.
- **GCOV:** covariance-based radar observations used by RiverShift's water/land-change screening.

The interface presents mapped outputs as candidates for interpretation and keeps the evidence context available alongside the visual result.

## Source implementation

| Experience area | Current source |
|---|---|
| Home and workflow entry | [Home.tsx](https://github.com/shourov-04/SARGuardian/blob/main/apps/web/src/pages/Home.tsx) |
| Four-step orientation | [HowItWorksPage.tsx](https://github.com/shourov-04/SARGuardian/blob/main/apps/web/src/pages/HowItWorksPage.tsx) |
| Workflow catalogue | [engineData.ts](https://github.com/shourov-04/SARGuardian/blob/main/apps/web/src/data/engineData.ts) |
| Displacement processing | [DisplacementPreparation.tsx](https://github.com/shourov-04/SARGuardian/blob/main/apps/web/landslide/ui/DisplacementPreparation.tsx) |
| Known Place analysis | [KnownPlaceAnalysisPanel.tsx](https://github.com/shourov-04/SARGuardian/blob/main/apps/web/landslide/ui/KnownPlaceAnalysisPanel.tsx) |
| RiverShift processing | [RiverShiftProcessingPage.tsx](https://github.com/shourov-04/SARGuardian/blob/main/apps/web/src/pages/RiverShiftProcessingPage.tsx) |
| RiverShift results | [RiverShiftResultsPage.tsx](https://github.com/shourov-04/SARGuardian/blob/main/apps/web/src/pages/RiverShiftResultsPage.tsx) |

## Recent UI/UX refinement

The reviewed 13 November source history includes:

- [Restore the RiverShift raster map overlay](https://github.com/shourov-04/SARGuardian/commit/7e79098f9d9f8be203306ef479ca86051564a5a3)
- [Add source-granule provenance presentation](https://github.com/shourov-04/SARGuardian/commit/df85bb93a4641fdddcfc12a8ed66fcdba5859a7f)
- [Place RiverShift QA panels below the map](https://github.com/shourov-04/SARGuardian/commit/03a64a2632fb8d59fc7a4625c1af64e80c4bf235)
- [Style scientific review panels](https://github.com/shourov-04/SARGuardian/commit/10c63d325d4e5dfdb8c4c0c39542f9d903048708)
- [Refine result navigation and provenance](https://github.com/shourov-04/SARGuardian/commit/8128f6741c83601787ea103ebaa1a6b652cbcfd9)
- [Restore the RiverShift observed-summary panel](https://github.com/shourov-04/SARGuardian/commit/b5ebc7de53b0ea03633d260438caed2dd5393389)

## Judge review path

Reviewers can follow the same sequence as a user: start with the home page, read the four-step orientation, inspect the displacement and Known Place flows, and then follow RiverShift from processing to its map and provenance panels. The [Video Presentation Brief](VIDEO_PRESENTATION_BRIEF.md) provides the matching judge-facing narrative.
