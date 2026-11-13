# SARGuardian

**NASA Space Apps Challenge 2026 · Dancing with the SARs · Earth Science**

SARGuardian is a NISAR-powered surface-change intelligence platform. It brings AOI-driven displacement screening, focused known-place analysis and NISAR GCOV river-change screening into one traceable application experience.

Users choose an area of interest and observation window, explore compatible NISAR products, follow processing progress and review candidate changes with acquisition dates, source identity and quality evidence.

## What the platform offers

| Workflow | User value | NISAR evidence |
|---|---|---|
| **Landslide / Find Displacements** | Search a selected area for displacement candidates without requiring a target point first. | GOFF offset diagnostics and gated GUNW phase/LOS diagnostics. |
| **Glacier Movement** | Explore surface-change evidence across glacier terrain through the shared AOI-wide displacement workflow. | The same distinct GOFF and GUNW evidence families used by Find Displacements. |
| **Known Place Analysis** | Define separate Measurement and Reference polygons for focused analysis and research reproduction. | Exact selected NISAR products, including the author-exact P05023 benchmark path. |
| **River Shift** | Explore observed water/land transitions and river-change candidates across a selected reach and date window. | NISAR L-band Level-2 GCOV. |

The workflow categories describe different user questions and evidence paths; they are not interchangeable scientific measurements.

## How it works

1. Select a place or draw an AOI and choose an observation window.
2. Discover compatible NISAR acquisitions for that request.
3. Process the selected products and retain their provenance.
4. Review maps, candidate layers, acquisition dates, quality checks and reports.

The current frontend includes a guided “How it works” journey, staged processing views, product counters, dedicated Known Place controls and a RiverShift results experience with map, summary, provenance and QA panels.

## Demonstrated processing evidence

[RiverShift Run #25 — 12 November 2026](https://github.com/shourov-04/SARGuardian/actions/runs/43260188660) completed an end-to-end Jamuna–Chowhali request using 10 exact NISAR L2 GCOV P05023 products across 10 actual acquisition dates. All 10 first-attempt product workers passed; the result manifest validated 72 output entries and private result publication completed with 73 receipts.

The run connects catalogue discovery, authenticated product retrieval, HDF5/layer checks, AOI extraction, shared-grid assembly, provenance and private result publication.

## Product and presentation documents

- [NASA Space Apps 2026 Final Submission Pack](docs/submission/SPACE_APPS_2026_FINAL_SUBMISSION_PACK.md)
- [Demonstration Video Brief — 4:05 Full HD](docs/submission/VIDEO_PRESENTATION_BRIEF.md)
- [Application Experience and UI/UX Brief](docs/submission/APPLICATION_UX_BRIEF.md)
- [RiverShift Judge Brief](docs/submission/RIVERSHIFT_2026_JUDGE_BRIEF.md)
- [Judge Evidence Matrix](docs/submission/score-sheet-evidence-matrix.md)

## Team and contributions

- **Moshiur Rahman Sarker — Team Lead:** Scientific Core Engine and processing development; overall project development and integration; project coordination; video editing. Department of Mathematics, Ananda Mohan College, Mymensingh, Bangladesh.
- **Sagor Chandra Modak:** Scientific Core Engine implementation in GitHub Actions; UI/UX design; final project polishing and refinement. Department of Computer Science & Engineering, Shahjalal University of Science and Technology (SUST), Sylhet, Bangladesh.
- **MD Fahim:** River Shift module and initial prototype development; video editing. Department of Computer Science and Engineering, Islamic University, Kushtia, Bangladesh.
- **Tasmia Binte Hasan:** Project storytelling, presentation development and communication of scientific impact. Department of Computer Science and Engineering, Islamic University, Kushtia, Bangladesh.

## Repository layout

- apps/web — React/Vite application.
- apps/api — application API and job orchestration.
- engines — Find Displacements, Known Place and RiverShift processing engines.
- science/nisar-core — NISAR scientific processing components.
- .github/workflows — automated processing and validation workflows.
- docs/submission — judge-facing product, video, UI/UX and evidence documentation.
- docs/migration — source-import and migration-history records.

## Scientific interpretation

SARGuardian organises evidence from real NISAR observations. A candidate is a starting point for investigation, not an automatic declaration of a confirmed event. Product families, acquisition dates, provenance and the specific quantity being measured remain visible so that results can be interpreted responsibly.

**Project source:** [SARGuardian repository](https://github.com/shourov-04/SARGuardian) · **Consolidated source:** [SARGuardian Monorepo](https://github.com/moshiour0/SARGuardian-Monorepo)
