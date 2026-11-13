# SARGuardian — NASA Space Apps 2026 Final Submission Pack

**Challenge:** Dancing with the SARs  
**Category:** Earth Science  
**Product:** SARGuardian — NISAR-powered surface-change intelligence  
**Evidence update:** 13 November 2026

## 1. The project in one sentence

**SARGuardian turns NASA–ISRO NISAR radar observations into traceable surface-change screening workflows for land, glacier terrain and rivers—so users can explore an area and time window, inspect candidate changes, and follow the observations and quality checks behind each result.**

## 2. Copy-ready project description

Earth's surface changes continuously, but observing those changes consistently is difficult. Radar observations complement optical imagery by providing a way to examine the land surface independent of daylight and through many cloud conditions. NISAR, the NASA–ISRO Synthetic Aperture Radar mission, supplies L-band observations designed to measure changes across land, water, vegetation and ice.

SARGuardian brings several NISAR-based workflows into one interactive platform. A user chooses an area of interest and an observation window, then explores the processing path appropriate to the question: target-free displacement screening, glacier-terrain movement screening, focused known-place research, or river-change screening from GCOV observations. Results retain acquisition dates, source-product identity, provenance and quality-control information.

SARGuardian helps users identify and investigate radar-derived signals that may indicate surface change. Its presentation connects each mapped candidate to the observation and processing context needed to interpret it responsibly.

## 3. Why this matters

Communities, researchers and planners need to understand where the Earth's surface may be changing and what evidence exists for those changes. A map becomes more useful when a reviewer can also inspect when the observation was made, which sensor product was used, how the product was qualified and what the resulting measurement represents.

SARGuardian is built around that evidence chain. The user can begin with a selected area and date range; the application searches for compatible NISAR products available for that request and qualifies the observations before processing.

The platform is designed for user-selected areas across the global NISAR observation programme. The actual released products, acquisition geometry, time series and valid raster support determine the observation record available for each specific request.

## 4. What users can do

SARGuardian presents four user-facing workflow categories. Their measurement paths remain distinct and are selected according to the user's question.

| User-facing workflow | What it does | Primary NISAR evidence |
|---|---|---|
| **Landslide / Find Displacements** | Scans a user-selected AOI and time window for displacement candidates without requiring a nominated target point. | GOFF offset diagnostics and, where the network and support gates pass, GUNW interferometric phase / line-of-sight diagnostics. |
| **Glacier Movement** | Applies the shared AOI-wide displacement workflow to glacier terrain where compatible observations exist. | The same distinct GOFF and gated GUNW evidence families used by Find Displacements. |
| **Known Place Analysis** | Supports focused two-polygon analysis: a Measurement Polygon and a Reference Polygon, with explicit source-product identity and evidence review. | Exact selected NISAR products, including the author-exact P05023 benchmark path where requested. |
| **River Shift** | Discovers and processes compatible NISAR GCOV acquisitions for a selected river reach and date window, then displays radar-derived water/land-transition candidates. | NISAR L-band Level-2 GCOV. |

### River Shift map classes

- **Blue:** newly water-covered / observed open-water candidate.
- **Red:** persistent land-to-water transition candidate, used for erosion screening.
- **Green:** persistent water-to-land transition candidate, used for deposition screening.

These are explainable screening classes connected to the source observations and spatial quality review.

## 5. Current application experience

The active application interface is documented against the public [shourov-04/SARGuardian fork](https://github.com/shourov-04/SARGuardian), whose main branch was reviewed at commit eb5e7e4790847789daf426df5328ead2c8674398 on 13 November 2026.

The user journey combines a project home page, four-step “How it works” orientation, staged displacement processing, focused Known Place controls and a dedicated RiverShift processing and result experience. The displacement view presents separate GUNW and GOFF counters. Known Place supports a selected GOFF candidate hand-off into a Measurement Polygon and catalogue release/variant selection. RiverShift provides processing settings and counters, a result map, observed summary, granule provenance, SHA-256 integrity hashes, spatial QA and uncertainty/sensitivity panels.

See the [Application Experience and UI/UX Brief](APPLICATION_UX_BRIEF.md) for the full walkthrough and current source links.

## 6. How the evidence chain works

1. **Choose an AOI and date window.** The request is location- and time-specific.
2. **Discover observations.** The workflow queries NASA CMR / ASF for relevant NISAR collections and exact granule identities.
3. **Qualify the data.** It checks product maturity, acquisition dates, orbit/frame and product configuration, footprint support, native layers and valid pixels.
4. **Process exact products.** Workers download accepted granules, verify HDF5 structure and expected layers, and perform the relevant raster processing.
5. **Preserve provenance.** Product identities, acquisition dates, checksums, manifests and processing receipts remain linked to outputs.
6. **Review results.** Users inspect actual observation dates, candidate layers, geometry/overlap diagnostics and evidence reports.
7. **Retain the result package.** The verified result package and manifest are retained through the configured private result-storage path.

## 7. Latest live River Shift evidence — Run #25

**Run:** [RiverShift Run #25 — GitHub Actions](https://github.com/shourov-04/SARGuardian/actions/runs/43260188660)  
**Repository / branch:** shourov-04/SARGuardian, main  
**Checked-out commit:** 8f9272adafc43ac080227083f12d122a8a271be8  
**Run date:** 12 November 2026  
**AOI case:** Jamuna–Chowhali demonstration request  
**Collection:** NISAR L2 GCOV PROVISIONAL, CRID P05023  
**Request window:** 12 November 2025–12 November 2026  
**Catalogue qualification:** NASA CMR returned 68 candidates; the compatibility and support audit selected 10 exact granules across 10 actual acquisition dates.

### Acquisition dates

| # | Acquisition date | # | Acquisition date |
|---:|---|---:|---|
| 1 | 18 June 2026 | 6 | 29 August 2026 |
| 2 | 30 June 2026 | 7 | 10 September 2026 |
| 3 | 12 July 2026 | 8 | 22 September 2026 |
| 4 | 24 July 2026 | 9 | 4 October 2026 |
| 5 | 17 August 2026 | 10 | 16 October 2026 |

All 10 first-attempt product worker jobs passed. The workflow completed with 24 successful jobs and 6 intentionally skipped jobs; no job failed. Product retrieval, authenticated ASF byte-range access, HDF5 inspection, requested-layer checks, AOI raster extraction and per-product artifact preparation passed for the selected products.

Ten date rasters were assembled and aligned to a shared observation grid. The source provenance manifest passed for all 10 products. The final result manifest validated **72 output entries**, and private result publication completed with **73 publication receipts**, followed by successful final assembly and signed callback.

Traceability values from the run:

- Source-granule provenance manifest SHA-256: 7c515d538024aaea176de2ac34e3d30360ce267bb56d46d6e1c8bce9e72de995
- Final result-manifest SHA-256: ca8c77d68f42041e74d4cf97735aac10636fa9eead5ce7133bece165ce93b47a

Run #25 is a complete end-to-end processing demonstration for its selected AOI, date window and compatible product series. It provides a reproducible record from catalogue discovery through private result publication.

## 8. NISAR data: what is used and why

| Product family | SARGuardian use |
|---|---|
| **GUNW** | Interferometric phase / line-of-sight displacement diagnostics where the required network, geometry and common-support gates pass. |
| **GOFF** | Range/azimuth offset diagnostics and displacement-candidate screening. |
| **GCOV** | Covariance-based radar observation support for River Shift water/land-change screening. |

NISAR products are measurement inputs, not decorative map layers. Basemaps and separately attributed context sources support navigation and interpretation but are not represented as NISAR measurements.

NASA describes NISAR as a global land and ice-observation mission with a nominal 12-day exact repeat cycle and an average revisit of about six days from ascending and descending observations. See the [NASA Mission Overview](https://science.nasa.gov/mission/nisar/mission-overview/) and [ASF NISAR Data Availability](https://nisar-docs.asf.alaska.edu/availability-overview/).

## 9. Scientific interpretation

SARGuardian connects mapped outputs to their measurement family, product identity, acquisition dates and quality evidence.

- GOFF offsets and GUNW phase/LOS are distinct measurement families.
- Pairwise LOS is not automatically cumulative or three-dimensional displacement.
- A structural/provenance PASS establishes processing integrity; geophysical interpretation uses the relevant scientific evidence.
- A user-defined Reference Polygon is a comparison region whose role is explicit in the analysis.
- RiverShift map classes are screening candidates connected to actual GCOV observations.
- Playback follows actual acquisition dates.
- Missing measurements remain identified as not measured, rather than being treated as zero.
- Comparison metrics are reported only when their source, temporal alignment, data definition and common spatial support satisfy the matching requirements.

These distinctions make the platform's outputs easier to inspect and interpret.

## 10. Team roles, contributions and collaboration

The team combined scientific processing, application design, river-change development and communication into one integrated product. A key integration hand-off connected the River Shift prototype to the shared Scientific Core Engine.

### 1. Moshiur Rahman Sarker — Team Lead

**Education:** Department of Mathematics, Ananda Mohan College, Mymensingh, Bangladesh.

**Responsibilities**
- Scientific Core Engine and processing development.
- Overall project development and integration.
- Project coordination.
- Video editing.

**Contribution:** Led overall project development and coordinated the team's work. Developed and integrated the core scientific processing capabilities across the project, including integrating the Scientific Core Engine into the River Shift workflow after the initial River Shift prototype was developed. Also contributed to video editing and visual presentation.

### 2. Sagor Chandra Modak — Scientific Core Engine Implementation, UI/UX Design and Final Project Preparation

**Education:** Department of Computer Science & Engineering, Shahjalal University of Science and Technology (SUST), Sylhet, Bangladesh.

**Responsibilities**
- Scientific Core Engine implementation in GitHub Actions.
- UI/UX design.
- Final project polishing and refinement.

**Contribution:** Contributed to implementing the Scientific Core Engine within the GitHub Actions workflow and designing the project's user interface and user experience. Led final polishing and refinement of the overall project.

### 3. MD Fahim — River Shift Development and Video Editing

**Education:** Department of Computer Science and Engineering, Islamic University, Kushtia, Bangladesh.

**Responsibilities**
- River Shift module development.
- River Shift prototype development.
- Video editing.

**Contribution:** Developed the River Shift module and its initial prototype, establishing the foundation for the feature. The Team Lead subsequently integrated the Scientific Core Engine into the River Shift workflow. Also contributed to video editing.

### 4. Tasmia Binte Hasan — Storytelling and Presentation

**Education:** Department of Computer Science and Engineering, Islamic University, Kushtia, Bangladesh.

**Responsibilities**
- Project storytelling.
- Presentation development.
- Communicating the project's scientific impact.

**Contribution:** Shaped the project's narrative and communicated its scientific objectives, technical contributions and real-world relevance in a clear and engaging presentation.

The team contributions connect scientific processing, UI/UX, RiverShift development, integration and judge-facing communication.

## 11. Demonstration video — 4:05 Full HD

The team demonstration video is approximately **4 minutes 5 seconds**, in **1920 × 1080 Full HD**, 16:9 format at 30 fps. It follows a clear narrative from the NISAR mission and team introduction to AOI-wide displacement screening, the Bhote Koshi P05023 benchmark and the Jamuna RiverShift example.

The video highlights:
- The user's journey from an area of interest and date window to mapped candidate evidence.
- The distinct GOFF and GUNW data streams used by displacement screening.
- The focused Known Place workflow and the five-pair P05023 Bhote Koshi benchmark, shown at **4.02 cm/day over 24 days** (approximately **0.96 m**).
- RiverShift's new-water, persistent-erosion and persistent-deposition map classes.
- The wider relevance of AOI-driven exploration across the global NISAR observation programme.

The message is that SARGuardian identifies radar-derived anomalies for investigation and makes their supporting evidence easier to inspect. See the [Video Presentation Brief](VIDEO_PRESENTATION_BRIEF.md) for the complete narrative and supporting links.

## 12. Judge review path

1. Read the project proposition and four workflow descriptions in this pack.
2. Watch the [4:05 Full HD demonstration video](VIDEO_PRESENTATION_BRIEF.md).
3. Follow the [application experience and UI/UX brief](APPLICATION_UX_BRIEF.md) to inspect the current interface and user journey.
4. Open [RiverShift Run #25](https://github.com/shourov-04/SARGuardian/actions/runs/43260188660) for the live ten-product processing record.
5. Use the [RiverShift Judge Brief](RIVERSHIFT_2026_JUDGE_BRIEF.md) and linked source code for the acquisition, processing and interpretation details.

## 13. Primary references

- [NASA NISAR Mission Overview](https://science.nasa.gov/mission/nisar/mission-overview/)
- [NASA NISAR mission page](https://science.nasa.gov/mission/nisar/)
- [ASF NISAR Data Availability](https://nisar-docs.asf.alaska.edu/availability-overview/)
- [ASF NISAR Product Overview](https://nisar-docs.asf.alaska.edu/products-overview/)
- [NASA CMR Search API](https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html)
- [SARGuardian Monorepo](https://github.com/moshiour0/SARGuardian-Monorepo)
- [Active SARGuardian fork and application](https://github.com/shourov-04/SARGuardian)
- [RiverShift Run #25 — 10-product end-to-end evidence](https://github.com/shourov-04/SARGuardian/actions/runs/43260188660)
- [Monorepo Snapshot Regression — 20/20 jobs passed](https://github.com/moshiour0/SARGuardian-Monorepo/actions/runs/43243267939)
