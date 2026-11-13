# Find Displacements — dashboard and result presentation

This directory contains the product-facing geospatial dashboard and presentation-bundle implementation for Find Displacements.

## What it presents

- AOI-specific product and acquisition metadata.
- Per-product raster previews and map layers derived from processed outputs.
- Product-pair information, source dates, track/look geometry, and measurement units.
- Quality, valid-pixel, overlap, and provenance information supplied by the processing bundle.
- Observed-date and product-pair navigation where the bundle includes compatible observations.
- Machine-readable manifests and supporting result metadata.

The native scientific outputs remain the analytical assets. A browser preview is a display representation and does not replace its source raster or manifest.

## Implementation boundaries

1. Display code may summarise and render scientific outputs; it must not silently change masks, measurements, product selection, or scientific acceptance criteria.
2. GOFF offsets and GUNW phase/LOS remain separate evidence families.
3. Do not connect incompatible pairs into a common displacement series without a supported common-reference solution and compatible geometry.
4. Preserve actual acquisition dates, product IDs, CRS, NoData, valid-pixel counts, checksums, AOI identity, and engine revision when available.
5. Keep unavailable pixels explicit; do not interpolate them into apparent hazard patterns.
6. A structural/provenance PASS is not an independent geophysical accuracy result.

## Source and validation

- Dashboard implementation: this directory.
- AOI processing and worker code: [Find Displacements engine](../).
- Automated workflow entry points: [repository Actions workflows](../../../.github/workflows/).
- Shared product readers and science functions: [NISAR core](../../../science/nisar-core/).
- Reviewer-facing method summary: [Scientific methods](../../../docs/submission/SCIENTIFIC_METHODS.md).

Use the result manifest and source product identifiers as the reference when interpreting any displayed metric.
