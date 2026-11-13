# RiverShift — NASA Space Apps 2026 judge brief

**Challenge:** Dancing with the SARs  
**Category:** Earth Science  
**Primary application:** https://sarguardian.vercel.app/  
**Primary source:** https://github.com/shourov-04/SARGuardian

## The central proposition

RiverShift is an AOI-driven river-change screening workflow powered by NASA–ISRO NISAR L-band GCOV observations. A user selects a river reach and an observation window. The application discovers compatible GCOV products for that exact geometry, processes the selected observations, and presents candidate changes together with acquisition dates and product provenance.

The Jamuna–Chowhali area is a demonstration context. It is not a fixed AOI built into the workflow.

## Why NISAR matters

NISAR's L-band observations provide a repeatable radar source for examining changing river environments. RiverShift makes those observations easier to explore by connecting AOI selection, product discovery, multi-date processing, map overlays, and result provenance.

Primary mission and product references:
- [NASA NISAR Mission Overview](https://science.nasa.gov/mission/nisar/mission-overview/)
- [NASA NISAR Observation Strategy](https://science.nasa.gov/mission/nisar/observation-strategy/)
- [ASF NISAR Data Availability](https://nisar-docs.asf.alaska.edu/availability-overview/)
- [ASF GCOV Product Guide](https://nisar-docs.asf.alaska.edu/gcov/)
- [NASA CMR Search API](https://cmr.earthdata.nasa.gov/search/site/docs/search/api.html)

## How the workflow operates

1. User draws a river-reach WGS84 AOI and selects dates.
2. Catalogue discovery searches for NISAR L-band GCOV granules intersecting that AOI and window.
3. The workflow qualifies actual acquisitions by date, footprint, orbit/frame, product maturity, polarization/frequency, covariance term, and native HDF5 layer availability.
4. The worker downloads and validates the selected products, extracts AOI rasters, aligns compatible observations, and calculates screening layers.
5. The application presents observed-date results, map overlays, source product identity, provenance manifests, and QA context.

The workflow is parameterised by the user's AOI and time period. Product eligibility is decided from the available observations and their compatibility, not from a preloaded regional result.

## What the map shows

- **Blue:** newly water-covered/open-water candidate.
- **Red:** persistent land-to-water transition candidate.
- **Green:** persistent water-to-land transition candidate.

The layers help users locate and compare radar-derived changes. They are not a substitute for field surveys or a direct measurement of sediment volume.

## Engineering and reproducibility

RiverShift has a dedicated processing worker and automated workflow. The source includes catalogue discovery, product download and HDF5 inspection, raster extraction/alignment, temporal screening, overlap QA, source manifests, checksums, result packaging, and callback integration.

Review locations:
- [RiverShift engine source](https://github.com/shourov-04/SARGuardian/tree/main/engines/river-shift)
- [RiverShift workflow source](https://github.com/shourov-04/SARGuardian/tree/main/.github/workflows/river-shift-gcov-process.yml)
- [Repository Actions history](https://github.com/shourov-04/SARGuardian/actions)
- [RiverShift tests](https://github.com/shourov-04/SARGuardian/tree/main/engines/river-shift/tools/river_shift/tests)

## Judging evidence

| Dimension | What to explore |
|---|---|
| Impact | Select a river reach and date window; inspect candidate land/water transitions and mapped context. |
| Creativity | AOI-driven multi-date radar processing, distinct transition layers, and observed-date playback. |
| Validity | Product compatibility gates, native-layer inspection, source granule manifests, hashes, raster QA, and engine tests. |
| Relevance | NISAR L-band GCOV is the primary measurement input for this river-change workflow. |
| Presentation | Map-based selection, clear overlay legend, acquisition-date navigation, and source-linked result information. |
| User experience | AOI drawing, date selection, catalogue preflight, processing status, and integrated result review. |
| NASA data usage | NISAR product inputs with NASA CMR/ASF discovery and product references; basemap context is identified separately. |

## Recommended reviewer path

1. Open the [live SARGuardian application](https://sarguardian.vercel.app/).
2. Select RiverShift, draw a manageable river-reach AOI, and choose an observation window.
3. Review the discovered GCOV acquisition dates and submit the workflow.
4. Explore the resulting map layers, playback dates, product identifiers, manifests, and QA panels.
5. Inspect the [RiverShift source](https://github.com/shourov-04/SARGuardian/tree/main/engines/river-shift) and the [Actions history](https://github.com/shourov-04/SARGuardian/actions).

For a complete product/data explanation, read the repository's [Reviewer Guide](../../../../docs/submission/REVIEWER_GUIDE.md) and [Scientific Methods](../../../../docs/submission/SCIENTIFIC_METHODS.md).
