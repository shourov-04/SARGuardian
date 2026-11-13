# Scientific methods and interpretation

SARGuardian organises NISAR-based surface-change analysis around the user's AOI, observation window, and the measurement family available for that request.

## 1. AOI and observation selection

The user selects a location or draws an AOI and chooses an observation period. The API validates the request and performs catalogue discovery through NASA CMR/ASF. Candidate granules are examined by the selected engine for product identity, observation dates, geometry, maturity, native layer availability, and valid data support.

The product list is a preflight record. The processing worker is responsible for product-level validation and scientific processing.

## 2. Find Displacements

Find Displacements is a target-free AOI-wide workflow. It scans the submitted area for candidate spatial displacement patterns rather than requiring the user to supply a target point.

**GOFF** contributes geocoded pixel-offset observations, including along-track and slant-range components. These support spatial offset screening and candidate localisation.

**GUNW** contributes unwrapped interferometric phase observations. Where valid and comparable observations are available, the workflow can produce pairwise Line-of-Sight diagnostics. GUNW is a separate measurement family and is not combined numerically with GOFF offsets.

## 3. Glacier Movement

Glacier Movement is the glacier-oriented entry to the shared AOI-wide displacement workflow. Users can select glacier terrain and an observation period, then examine candidate surface-change signals and the available GOFF/GUNW evidence using the same processing architecture.

## 4. Known Place Analysis

Known Place Analysis enables focused inspection of a user-selected location.

- **Measurement Polygon:** the area for which the user wants to examine observations.
- **Reference Polygon:** the comparison area used by the configured analysis.

The generic two-polygon workflow is separate from the fixed author-exact research reproduction route. A reference polygon is a user-specified comparison region; it is not automatically a verified stable-ground control.

The Bhote Koshi research benchmark uses the author-selected **P05023** product revision, five GOFF pairs, and the 26 July–19 August 2026 interval. The reported median offset magnitude is approximately 0.96 m over 24 days, corresponding to a descriptive rate of about 4.02 cm/day. This value belongs to that defined research case and acquisition configuration.

## 5. RiverShift

RiverShift is the NISAR L-band GCOV workflow for river and surface-water change screening. It discovers compatible GCOV acquisition dates for the submitted river AOI, checks the product configuration and source layers, aligns eligible raster observations, and derives the configured change classes.

The result map uses three distinct classes:

- **Blue — newly water-covered/open-water candidate:** pixels classified as water in the later observation under the workflow's comparison rules.
- **Red — persistent land-to-water transition candidate:** a persistent transition used for erosion-oriented screening.
- **Green — persistent water-to-land transition candidate:** a persistent transition used for deposition/land-emergence screening.

RiverShift uses actual acquisition dates. It does not synthesize daily observations between acquisitions. The map previews communicate the result spatially; the result package and source manifest retain the analytical context.

## 6. Provenance and quality information

Depending on the product and workflow, review information includes:

- NISAR product family and granule identifier.
- Acquisition/reference/secondary dates and geometry.
- Processing maturity and product configuration.
- AOI geometry and request parameters.
- Source download receipt and SHA-256 checksums where emitted.
- Native HDF5 layer inventory and raster-grid details.
- Valid-pixel, overlap, mask, and output QA information.
- Workflow run, processing stage, result manifest, and artifact reference.

These records allow a reviewer to trace displayed outputs back to their source observations and processing path.

## 7. Interpretation protocol

- Treat GOFF anomalies as candidate signals that require scientific interpretation.
- Read GUNW as pairwise phase/LOS evidence, not automatically cumulative or three-dimensional displacement.
- Read RiverShift classes as satellite-derived screening candidates.
- Keep software tests, processing checks, provenance checks, and independent geophysical reference comparisons as distinct evidence categories.
- Interpret every output in the context of its AOI, observation dates, product family, geometry, maturity, and valid data support.

This protocol makes the product's measurements and their provenance explicit for both human and AI-assisted review.
