# SARGuardian — NASA Space Apps 2026 Demonstration Video

**Challenge:** Dancing with the SARs  
**Category:** Earth Science  
**Runtime:** 4 minutes 5 seconds  
**Format:** 1920 × 1080 Full HD · 16:9 · 30 fps  
**Media size:** approximately 105 MB

## Video purpose

The demonstration introduces SARGuardian as a NISAR-powered surface-change intelligence platform and guides viewers from the mission context to the application's principal analysis experiences. It combines a project introduction, team contributions, real workflow screens and representative scientific case views in one judge-friendly narrative.

## Demonstration sequence

### 1. NISAR and the changing Earth

The opening establishes the observation challenge across mountain terrain, glacier environments and river systems. It introduces NASA–ISRO NISAR as the radar observation source and SARGuardian as the platform for exploring surface-change evidence through a user-selected area of interest and observation window.

### 2. The team behind SARGuardian

The video introduces four complementary workstreams:

- **Moshiur Rahman Sarker — Team Lead:** Scientific Core Engine and processing development, overall project development and integration, project coordination and video editing.
- **Sagor Chandra Modak:** Scientific Core Engine implementation in GitHub Actions, UI/UX design and final project polishing.
- **MD Fahim:** River Shift module and initial prototype development, with video-editing contributions.
- **Tasmia Binte Hasan:** Project storytelling, presentation development and communication of scientific impact.

### 3. Find Displacements — area-wide screening

The video shows the user selecting an area and date window, then following the displacement-screening workflow from the AOI to candidate evidence and focused review. The processing view presents two distinct NISAR measurement families: GOFF offset diagnostics and GUNW interferometric/line-of-sight diagnostics.

The displayed study sequence uses a 20-worker processing view, with 10 GOFF and 10 GUNW workers shown as successful for the 20 June–23 August 2026 study window. This screen communicates the separation of measurement families and the staged processing workflow.

### 4. Known Place Analysis — Bhote Koshi benchmark

The Known Place sequence demonstrates a focused analysis with separate Measurement and Reference polygons. It presents the author-exact NISAR L-band P05023 GOFF benchmark for Bhote Koshi, based on five GOFF pairs spanning 26 July–19 August 2026.

The benchmark view reports an average rate of **4.02 cm/day over 24 days**, corresponding to approximately **0.96 m** across the interval. The central message is that the radar-derived anomaly was identified for further attention; the project did not claim to predict a collapse.

### 5. RiverShift — river-change screening

The RiverShift sequence presents the Jamuna–Chowhali demonstration area, map layers and observed-date result exploration:

- **Blue:** new-water / newly water-covered candidate.
- **Red:** persistent land-to-water transition candidate, used for erosion screening.
- **Green:** persistent water-to-land transition candidate, used for deposition screening.

The representative result view highlights approximately **17.67 km²** of new-water candidate area. The map communicates distinct, interpretable screening layers tied to radar observations.

### 6. Global applicability

The closing returns to the platform's AOI-driven approach: users select locations and observation windows within the global NISAR observation programme, while the compatible products actually released for each place and period determine the analysis series.

## Traceable supporting evidence

The video is the guided presentation of the product. The separately linked [RiverShift Run #25](https://github.com/shourov-04/SARGuardian/actions/runs/43260188660) provides the detailed, independently inspectable processing record for its 10-product Jamuna–Chowhali demonstration request, including acquisition dates, product provenance, result manifest and publication receipts.

The video includes both mission/context visuals and product demonstrations. Reviewers can use the [Application Experience and UI/UX Brief](APPLICATION_UX_BRIEF.md) to locate the corresponding interface implementation and the [RiverShift Judge Brief](RIVERSHIFT_2026_JUDGE_BRIEF.md) to inspect the live processing evidence.

## Copy-ready video description

**SARGuardian is a NISAR-powered surface-change intelligence platform built for NASA Space Apps 2026 — Dancing with the SARs.** This demonstration follows the journey from AOI-wide displacement screening to focused Known Place Analysis and RiverShift. It highlights NISAR GOFF, GUNW and GCOV observations, the Bhote Koshi P05023 benchmark, mapped river-change candidates and source-aware evidence review. SARGuardian helps users explore where surface change may be occurring and trace the radar observations behind each result.

## Closing message

**SARGuardian turns real radar observations into traceable candidate evidence that people can explore, review and investigate.**
