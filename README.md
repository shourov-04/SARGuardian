# SARGuardian
### NISAR-Powered Surface Change Intelligence
**NASA Space Apps Challenge 2026 · Dancing with the SARs · Earth Science**

SARGuardian is a NISAR-powered platform for exploring and investigating changes across Earth's surface. It connects area-of-interest (AOI) selection, NISAR product discovery, automated scientific processing, and interactive geospatial results in one workflow.

**Explore the live platform:** https://sarguardian.vercel.app/

Reviewers, researchers, and interested users are invited to select an area and observation period, run an available analysis, and examine the resulting maps, measurements, acquisition information, and processing provenance. Results depend on compatible NISAR observations and products released for the selected place and time.

---

## What you can explore

| Workflow | What it helps investigate | Main NISAR evidence |
|---|---|---|
| **Find Displacements** | AOI-wide, target-free discovery of potential surface-displacement signals, including landslide-oriented screening | GOFF offset observations and separately presented GUNW phase/Line-of-Sight (LOS) diagnostics |
| **Glacier Movement** | Candidate surface-change and movement signals in glacier environments | The shared displacement workflow, with GOFF and GUNW kept as distinct evidence families |
| **Known Place Analysis** | Focused investigation of a user-selected location using separate Measurement and Reference Polygons | Compatible NISAR products selected for the analysis; includes a separately gated author-exact P05023 research path |
| **RiverShift** | River and water/land transition screening across a selected reach and observation window | NISAR L-band Level-2 GCOV observations |

### How it works

1. **Choose an area:** Search for a place or define an AOI on the map.
2. **Set the observation window:** Select the period to investigate.
3. **Discover compatible data:** Search available NISAR acquisitions and products for that request.
4. **Run the analysis:** The scientific processing workflows execute through the platform's processing infrastructure.
5. **Explore the result:** Review spatial layers, acquisition dates, product provenance, quality information, and available measurements.

The platform presents actual observations and available processing outputs. It does not fabricate missing acquisitions or treat unobserved periods as measured change.

## Scientific processing and GitHub Actions

The **Scientific Core Engine** is the processing foundation behind SARGuardian. It contains the scientific and geospatial workflows that transform compatible NISAR products into analysis outputs.

**GitHub Actions plays a central engineering role** in implementing and operating these workflows. It provides automated workflow execution and orchestration for processing workers, product handling, quality checks, provenance, result assembly, and delivery.

The repository is therefore more than the source code for a website: it also contains the processing engines and automation that make live analyses possible. Explore the workflow definitions in [`.github/workflows`](.github/workflows) and the processing components under [`engines/`](engines/).

## Scientific interpretation

SARGuardian is designed to help users investigate satellite-derived signals, not to overstate what those signals prove.

- A GOFF anomaly is a candidate signal, not automatic proof of a landslide or confirmed ground movement.
- GUNW phase/LOS diagnostics are distinct from GOFF offsets. Pairwise LOS observations are not automatically cumulative or three-dimensional displacement.
- A RiverShift map class is a change-screening candidate, not by itself field-confirmed erosion, deposition, flood damage, or sediment volume.
- A successful processing or structural QA status is not independent geophysical validation.
- A missing or unavailable measurement must not be interpreted as zero.
- Playback represents actual acquisition observations, not a forecast or interpolated time series.

For every analysis, interpretation depends on the selected AOI, product family, acquisition dates, compatibility, and usable pixel support.

## Team and contributions

| Team member | Project contribution |
|---|---|
| **[Moshiur Rahman Sarker](https://github.com/moshiour0)** · Team Lead | Scientific Core Engine and processing development; overall project development and integration; project coordination; video editing. Department of Mathematics, Ananda Mohan College, Mymensingh, Bangladesh. |
| **[Shagor Chandra Modak](https://github.com/Sagormodak)** | Scientific Core Engine implementation through GitHub Actions; UI/UX design; final project polishing and refinement. Computer Science and Engineering, Shahjalal University of Science and Technology (SUST), Bangladesh. |
| **[MD Fahim](https://github.com/mdfahim15164-cell)** | RiverShift development and video editing. Computer Science and Engineering, Islamic University, Kushtia, Bangladesh. |
| **Tasmia Binte Hasan** | Project storytelling and presentation. |

### Public repository — GitHub Insights snapshot

The following figures are transcribed from the **SARGuardian repository Insights → Contributors** view supplied by the team. The selected view covers **8 August–6 November 2026**, for the `main` branch, with merge commits excluded.

| GitHub author | Attributed commits |
|---|---:|
| [`moshiour0`](https://github.com/moshiour0) — Moshiur Rahman Sarker | **2,467** |
| [`Sagormodak`](https://github.com/Sagormodak) — Shagor Chandra Modak | **374** |

The same Insights view also attributes 48 commits to Copilot and 2 to `github-actions[bot]`. These tool/automation identities are listed separately and are not counted as human team members.

- [Open SARGuardian contributor graph](https://github.com/shourov-04/SARGuardian/graphs/contributors?from=08%2F08%2F2026)
- [Browse SARGuardian main-branch commit history](https://github.com/shourov-04/SARGuardian/commits/main)
- [Open SARGuardian repository Insights](https://github.com/shourov-04/SARGuardian/pulse)

### Earlier application repository — additional contribution history

Before the current public-facing repository, application development also took place in [`SARGuardian_Dynamic`](https://github.com/mdfahim15164-cell/SARGuardian_Dynamic). Its contribution history is kept separate from the current repository's Insights figures.

A check of that repository's `main`-branch commit records for the supplied 8 August–6 November 2026 window found the visible commit history spanning **15 October–2 November 2026**. Excluding merge commits, the author attribution was:

| GitHub author | Non-merge commits in the earlier Dynamic repository |
|---|---:|
| [`mdfahim15164-cell`](https://github.com/mdfahim15164-cell) — MD Fahim | **182** |
| [`moshiour0`](https://github.com/moshiour0) — Moshiur Rahman Sarker | **101** |
| [`Sagormodak`](https://github.com/Sagormodak) — Shagor Chandra Modak | **47** |

These are a **separate repository-history count**, not an addition to the current SARGuardian Insights totals. The project contribution descriptions above explain each person's responsibilities; GitHub's graphs and commit history show repository-attributed activity.

- [Open SARGuardian_Dynamic contributor graph](https://github.com/mdfahim15164-cell/SARGuardian_Dynamic/graphs/contributors?from=08%2F08%2F2026)
- [Browse SARGuardian_Dynamic main-branch commit history](https://github.com/mdfahim15164-cell/SARGuardian_Dynamic/commits/main)

## Repository structure

- `apps/web/` — React/Vite web application.
- `apps/api/` — application API and job orchestration.
- `engines/` — displacement, Known Place, and RiverShift processing components.
- `science/nisar-core/` — NISAR scientific processing source.
- `.github/workflows/` — automated processing and validation workflows.
- `docs/` — project, scientific, operational, and migration documentation.

## Brief repository history

The current consolidated codebase brings together work from three earlier SARGuardian repositories:

- [SARGuardian_Dynamic](https://github.com/moshiour0/SARGuardian_Dynamic) — web application and application API.
- [SARGuardian-backend](https://github.com/moshiour0/SARGuardian-backend) — scientific processing workers and reusable GitHub Actions workflows.
- [SARGuardian](https://github.com/moshiour0/SARGuardian) — NISAR science and processing source.

Their source history and migration records are retained in [`docs/migration/`](docs/migration/). This short note explains the origins; the main focus of this repository is the SARGuardian platform and its scientific capabilities.

## Useful links

- **Live application:** https://sarguardian.vercel.app/
- **Source repository:** https://github.com/shourov-04/SARGuardian
- **NASA NISAR mission:** https://science.nasa.gov/mission/nisar/mission-overview/
- **ASF NISAR data availability:** https://nisar-docs.asf.alaska.edu/availability-overview/
- **ASF NISAR product guide:** https://nisar-docs.asf.alaska.edu/products-overview/

---

**SARGuardian — explore real NISAR observations, run your own analysis, and investigate a changing Earth.**
