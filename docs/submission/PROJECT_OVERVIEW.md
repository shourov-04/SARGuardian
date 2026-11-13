# SARGuardian — project overview

**NASA Space Apps Challenge 2026**  
**Challenge:** Dancing with the SARs  
**Category:** Earth Science

## Open and explore

- **Live application:** https://sarguardian.vercel.app/
- **Primary public GitHub repository:** https://github.com/shourov-04/SARGuardian
- **Automated processing and validation history:** https://github.com/shourov-04/SARGuardian/actions

SARGuardian is a NISAR-powered surface-change intelligence platform. It connects an AOI-driven user experience with NISAR product discovery, automated scientific processing, and interactive geospatial result review.

## Four workflows

1. **Find Displacements** — target-free AOI-wide candidate discovery using GOFF offsets and separately handled GUNW phase/LOS diagnostics.
2. **Glacier Movement** — glacier-oriented exploration through the shared AOI displacement workflow.
3. **Known Place Analysis** — focused analysis with separate Measurement and Reference Polygons, including a dedicated research reproduction path.
4. **RiverShift** — multi-date GCOV analysis for newly water-covered areas and persistent land–water transition candidates.

## Why NISAR is central

NISAR observations are the measurement inputs, not decorative context. GOFF, GUNW, and GCOV provide different forms of radar evidence and are handled separately. ASF and NASA CMR provide product discovery/access services. The application surfaces actual acquisition dates, product identity, and processing provenance so that users can inspect how an output was produced.

## How the platform operates

The user selects an AOI and observation period. The application sends an authenticated request to the API. Catalogue preflight locates candidate products. The processing request is then coordinated through the relevant GitHub Actions workflow and product-specific engine. Results and their provenance are returned for review in the application.

GitHub Actions is an essential part of the scientific implementation: it executes the automated product workers and processing workflows, coordinates validation stages, and assembles result packages.

## Core repository map

- `apps/web/` — browser application and interactive result experience.
- `apps/api/` — authenticated API, job orchestration, dispatch and result adapters.
- `engines/find-displacements/` — AOI-wide displacement processing.
- `engines/known-place/` — two-polygon and research-analysis workflows.
- `engines/river-shift/` — NISAR GCOV river-change processing.
- `science/nisar-core/` — shared scientific modules.
- `.github/workflows/` — automated processing and validation.
- `docs/submission/` — reviewer-oriented project and method documents.

## Review invitation

We invite judges and researchers to open the live application, choose an area and dates of interest, and explore an available workflow. The most direct way to understand SARGuardian is to run an analysis through the application and inspect the returned maps, source products, acquisition dates, and processing information.

For the recommended review sequence, see [REVIEWER_GUIDE.md](REVIEWER_GUIDE.md).
