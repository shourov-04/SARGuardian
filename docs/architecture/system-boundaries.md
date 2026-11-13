# SARGuardian system architecture

**Project repository:** [shourov-04/SARGuardian](https://github.com/shourov-04/SARGuardian)  
**Live application:** https://sarguardian.vercel.app/

## System at a glance

SARGuardian is organised as a web application, an authenticated API/orchestration layer, product-specific scientific engines, and automated GitHub Actions workflows.

| Layer | Repository location | Responsibility |
|---|---|---|
| Web application | `apps/web/` | User interface, map/AOI selection, sign-in, workflow entry, processing status, dashboard and results |
| API | `apps/api/` | Authenticated request validation, catalogue discovery, job records, workflow dispatch, callbacks and result retrieval |
| Find Displacements | `engines/find-displacements/` | AOI-wide displacement candidate screening, product processing, dashboards and science diagnostics |
| Known Place | `engines/known-place/` | Focused AOI analysis, two-polygon measurement/reference workflow, and research reproduction tools |
| RiverShift | `engines/river-shift/` | Multi-date NISAR GCOV processing, water/change screening, raster QA, manifests and result packaging |
| Shared NISAR science | `science/nisar-core/` | Reusable NISAR readers and scientific analysis modules |
| Automation | `.github/workflows/` and engine-local workflow directories | Processing workers, orchestration, validation, retries, callbacks and artifact handling |
| Documentation | `docs/` and engine-local docs | Reviewer guides, methods, operational instructions and historical lineage |

## Browser-to-result flow

1. The user opens the web application and signs in through Firebase Authentication when a protected workspace is entered.
2. The browser sends an authenticated request to the configured API origin.
3. The API validates the user, AOI, date window, selected products, and workflow-specific request contract.
4. Catalogue preflight retrieves NISAR granule metadata from ASF/NASA CMR. It is a discovery stage, distinct from analysis.
5. A confirmed processing job is coordinated through the relevant GitHub Actions workflow.
6. The worker obtains compatible products, validates source metadata and native product layers, and runs the selected engine.
7. Workflow outputs, result manifests, quality information, and provenance are returned through the job/result contract.
8. The web application presents the result for inspection.

The exact request and response models are implemented in `apps/web/src/api/catalog.ts` and `apps/api/app/`.

## Product and workflow boundaries

### Find Displacements

The user selects an AOI and observation window. The workflow performs target-free spatial candidate discovery. GOFF offsets and GUNW phase/LOS diagnostics are separate measurement families and are reviewed independently.

### Glacier Movement

Glacier Movement is a user-facing category that routes into the shared AOI-wide displacement analysis. The category expresses the application context; it does not create a separate measurement family.

### Known Place Analysis

Known Place Analysis uses distinct Measurement and Reference Polygons. The generic user-defined AOI path is separate from the author-exact research reproduction path so that generic user input does not silently change a fixed research benchmark.

### RiverShift

RiverShift is an independent GCOV-oriented workflow. It discovers eligible acquisition dates for the submitted river AOI, validates product compatibility and raster support, derives the configured water/change screening layers, and packages observed-date results with source provenance.

## Identity, jobs, and result handling

- Firebase ID tokens authenticate browser-to-API requests.
- The API applies user ownership checks to job reads and writes.
- Job requests preserve the AOI, dates, selected processing options, and request identity needed to connect the UI, API, and worker.
- GitHub Actions workers use server-side credentials and return status through the configured callback contract.
- Result artifacts and manifests retain product identity and processing provenance. Private storage credentials are never sent to the browser.

## Source navigation

- [Web app](../../apps/web/)
- [API](../../apps/api/)
- [Find Displacements](../../engines/find-displacements/)
- [Known Place](../../engines/known-place/)
- [RiverShift](../../engines/river-shift/)
- [Shared science](../../science/nisar-core/)
- [Root Actions workflows](../../.github/workflows/)
