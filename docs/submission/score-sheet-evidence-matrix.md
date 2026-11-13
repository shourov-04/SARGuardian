# SARGuardian — NASA Space Apps 2026 Judge Evidence Matrix

**Challenge:** Dancing with the SARs  
**Category:** Earth Science  
**Product:** SARGuardian — NISAR-powered surface-change intelligence  
**Evidence update:** 13 November 2026

This matrix guides reviewers to the product features and evidence that support each judging dimension.

## Judging criteria and evidence

| Criterion | What SARGuardian demonstrates | Evidence to inspect |
|---|---|---|
| **Impact** | AOI-driven screening for slope, glacier-terrain, known-place and river-change questions, illustrated through regional use cases. | Final submission pack, Bhote Koshi benchmark, RiverShift Run #25 and the demonstration video. |
| **Creativity** | Target-free AOI-wide displacement discovery, candidate-to-Known-Place hand-off, separate two-polygon analysis and multi-date GCOV river screening. | Application Experience brief, Find Displacements and Known Place source, RiverShift guide. |
| **Validity** | Exact NISAR product identity, acquisition dates, HDF5/layer checks, source manifests, checksums, common-grid alignment, spatial QA and reproducible processing records. | RiverShift Run #25, result manifests, engine tests and RiverShift Judge Brief. |
| **Relevance** | NISAR data are the measurement inputs: GUNW phase, GOFF offsets and GCOV covariance observations serve distinct scientific roles. | NISAR data mapping in the Final Submission Pack, NISAR science core and processing engines. |
| **Presentation** | A 4:05 Full HD demonstration video, guided product orientation, workflow screens, mapped results and a coherent scientific narrative. | Video Presentation Brief and Application Experience brief. |
| **Teamwork** | Four complementary workstreams across scientific-core development, UI/UX, RiverShift module/prototype development, integration, storytelling and presentation. | Final Submission Pack — Team roles, contributions and collaboration. |
| **User experience** | Map-first AOI selection, four-step orientation, staged processing, product counters, candidate-to-Known-Place hand-off, result navigation and evidence panels. | Application Experience and UI/UX Brief; current SARGuardian frontend. |
| **NASA data usage** | NISAR products drive the core analysis; NASA CMR/ASF support product discovery and access; provenance is retained with results. | Product manifests, workflow implementations, Run #25 and NISAR data mapping. |
| **Challenge category** | “Dancing with the SARs” and “Earth Science” are identified consistently across the submission materials. | README and Final Submission Pack. |
| **Repository access** | Public source repositories provide access to the application, processing implementation and supporting judge documentation. | [SARGuardian Monorepo](https://github.com/moshiour0/SARGuardian-Monorepo) and [active SARGuardian fork](https://github.com/shourov-04/SARGuardian). |

## The four workflow experiences

### Landslide / Find Displacements

- Target-free AOI-wide candidate discovery.
- Separate GOFF offset and GUNW phase/LOS diagnostics.
- Candidate geometry can be transferred into Known Place Analysis for focused investigation.

### Glacier Movement

- Uses the shared AOI-wide displacement workflow for glacier terrain.
- The interface keeps the user-facing glacier category connected to the underlying displacement evidence path.

### Known Place Analysis

- Separate Measurement and Reference polygons.
- Candidate hand-off from Find Displacements.
- Product-release discovery and selected-series configuration.
- Author-exact P05023 benchmark path kept distinct from generic two-polygon analysis.

### River Shift

- NISAR L2 GCOV discovery and processing for a user-selected AOI/date window.
- Separate new-water, persistent-erosion and persistent-deposition candidate layers.
- Observed-date exploration, source-granule provenance, integrity hashes and spatial QA.

## Scientific interpretation framework

The product keeps the observation, measurement family and interpretation connected:

- A catalogue match is followed by product compatibility and spatial-support checks.
- GOFF offsets and GUNW phase/LOS remain distinct measurement families.
- Pairwise LOS is not automatically cumulative or three-dimensional displacement.
- Processing/provenance checks remain distinguishable from geophysical interpretation.
- Map classes are screening candidates tied to their source observations.
- Playback follows actual acquisition dates.
- “Not measured” remains distinct from zero.
- Comparison metrics use matched source, temporal, measurement-definition and spatial-support requirements.

## Judge quick path

1. Start with the [Final Submission Pack](SPACE_APPS_2026_FINAL_SUBMISSION_PACK.md).
2. Watch the [4:05 demonstration video](VIDEO_PRESENTATION_BRIEF.md).
3. Follow the [Application Experience and UI/UX Brief](APPLICATION_UX_BRIEF.md).
4. Open [RiverShift Run #25](https://github.com/shourov-04/SARGuardian/actions/runs/43260188660) for the successful ten-product processing record.
5. Use the [RiverShift Judge Brief](RIVERSHIFT_2026_JUDGE_BRIEF.md) for the method and acquisition details.

## Primary implementation references

- [Active SARGuardian frontend](https://github.com/shourov-04/SARGuardian/tree/main/apps/web)
- [Monorepo scientific engines](https://github.com/moshiour0/SARGuardian-Monorepo/tree/main/engines)
- [NISAR science core](https://github.com/moshiour0/SARGuardian-Monorepo/tree/main/science/nisar-core)
- [NASA NISAR Mission Overview](https://science.nasa.gov/mission/nisar/mission-overview/)
- [ASF NISAR Data Availability](https://nisar-docs.asf.alaska.edu/availability-overview/)
- [NASA CMR Search API](https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html)
