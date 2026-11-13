# Known Place Analysis

Known Place Analysis is SARGuardian's focused, user-defined location workflow. It allows a reviewer or analyst to select an outer AOI and observation period, then define separate spatial roles for measurement and comparison.

## Workflow concepts

- **Measurement Polygon:** the area whose NISAR observations are being examined.
- **Reference Polygon:** the comparison area used by the configured analysis.
- **AOI/date request:** the geographical and temporal scope submitted by the user.
- **Product selection:** compatible GOFF observations and the corresponding acquisition metadata.
- **Result review:** pair-level outputs, spatial context, source provenance, and processing information.

## Two distinct analysis paths

1. **Generic Known Place analysis** — accepts user-defined geometry and dates for a focused two-polygon analysis.
2. **Author-exact research reproduction** — a separately configured replay path that preserves the fixed P05023 research product selection and associated benchmark configuration.

These paths must remain separate. A generic user request must not silently alter the author-exact research benchmark.

## Source navigation

- UI and route integration: [web application](../../apps/web/).
- API request and dispatch adapter: [Known Place API implementation](../../apps/api/app/known_place.py).
- Processing engine and tools: this directory.
- Workflow definitions: [Known Place workflows](../../.github/workflows/).
- Scientific interpretation: [Scientific methods](../../docs/submission/SCIENTIFIC_METHODS.md).
- Reviewer entry path: [Reviewer guide](../../docs/submission/REVIEWER_GUIDE.md).

## Research benchmark

The Bhote Koshi benchmark uses the author-selected **P05023** revision, five GOFF pairs, and the 26 July–19 August 2026 interval. The project documentation reports an approximately 0.96 m median offset magnitude and a descriptive rate of about 4.02 cm/day for the benchmark interval. This is a defined research case; it is not a universal rate for other AOIs.

## Engineering principles

Preserve the selected product identities, source hashes, acquisition dates, polygon roles, request parameters, and result provenance. The displayed reference polygon is a comparison region supplied to the analysis; it should not be silently described as independently verified stable ground.
