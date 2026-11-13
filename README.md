# SARGuardian

**NASA Space Apps Challenge 2026 · Dancing with the SARs · Earth Science**

SARGuardian is a NISAR-powered surface-change intelligence platform. It brings AOI-driven displacement screening, focused known-place analysis and NISAR GCOV river-change screening into one traceable application experience.

**Live application:** [Open SARGuardian](https://sar-guardian-monorepo-web.vercel.app/)  
**Public submission repository:** [shourov-04/SARGuardian](https://github.com/shourov-04/SARGuardian)

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

## Try SARGuardian and inspect a live run

Reviewers are invited to open the live application, select an area of interest and observation window, and explore the available workflows. Where processing is enabled for the reviewer account and compatible NISAR products are available, submit a request and inspect the resulting observations and outputs directly in the application.

**GitHub Actions is central to SARGuardian's Scientific Core Engine implementation and execution.** It dispatches and coordinates workflow stages for catalogue discovery, exact-product retrieval, data/layer validation, scientific-engine execution, artifact retention, provenance checks and result delivery. The scientific algorithms themselves live in the version-controlled processing engines and NISAR science modules; Actions provides repeatable orchestration and execution. Each new request can create a fresh run, so reviewers are encouraged to inspect a current workflow rather than rely on one historical run link.

- [Open the live SARGuardian application](https://sar-guardian-monorepo-web.vercel.app/)
- [Inspect GitHub Actions workflow definitions](https://github.com/shourov-04/SARGuardian/tree/main/.github/workflows)
- [Inspect scientific engines](https://github.com/shourov-04/SARGuardian/tree/main/engines)

## Product and presentation documents

- [NASA Space Apps 2026 Final Submission Pack](docs/submission/SPACE_APPS_2026_FINAL_SUBMISSION_PACK.md)
- [Demonstration Video Brief — 4:05 Full HD](docs/submission/VIDEO_PRESENTATION_BRIEF.md)
- [Application Experience and UI/UX Brief](docs/submission/APPLICATION_UX_BRIEF.md)
- [RiverShift Judge Brief](docs/submission/RIVERSHIFT_2026_JUDGE_BRIEF.md)
- [Judge Evidence Matrix](docs/submission/score-sheet-evidence-matrix.md)
- [AI Usage Disclosure](docs/submission/AI_USAGE.md)

## Team and contributions

- **Moshiur Rahman Sarker — Team Lead:** Scientific Core Engine and processing development; overall project development and integration; project coordination; video editing. Department of Mathematics, Ananda Mohan College, Mymensingh, Bangladesh.
- **Sagor Chandra Modak:** Scientific Core Engine implementation and workflow integration through GitHub Actions; UI/UX design; final project polishing and refinement. Department of Computer Science & Engineering, Shahjalal University of Science and Technology (SUST), Sylhet, Bangladesh.
- **MD Fahim:** River Shift module and initial prototype development; video editing. Department of Computer Science and Engineering, Islamic University, Kushtia, Bangladesh.
- **Tasmia Binte Hasan:** Project storytelling, presentation development and communication of scientific impact. Department of Computer Science and Engineering, Islamic University, Kushtia, Bangladesh.

## Repository layout

- apps/web — React/Vite application.
- apps/api — application API and job orchestration.
- engines — Find Displacements, Known Place and RiverShift processing engines.
- science/nisar-core — NISAR scientific processing components.
- .github/workflows — automated processing and validation workflows.
- docs/submission — judge-facing product, video, UI/UX and evidence documentation.
- docs/migration — concise source-import and migration-history records for the original application, backend processing and NISAR science components.

## Scientific interpretation

SARGuardian organises evidence from real NISAR observations. A candidate is a starting point for investigation, not an automatic declaration of a confirmed event. Product families, acquisition dates, provenance and the specific quantity being measured remain visible so that results can be interpreted responsibly.

**Project source:** [SARGuardian repository](https://github.com/shourov-04/SARGuardian) · **Consolidated source:** [SARGuardian Monorepo](https://github.com/moshiour0/SARGuardian-Monorepo)
