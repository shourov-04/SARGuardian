# Reviewer guide — explore SARGuardian

## Start here

**Live application:** https://sarguardian.vercel.app/  
**Primary public repository:** https://github.com/shourov-04/SARGuardian  
**GitHub Actions history:** https://github.com/shourov-04/SARGuardian/actions

The recommended validation is to use the live application with an AOI and observation window of your choice, then inspect the returned product and processing records.

## A. Explore the live application

1. Open the live website.
2. Sign in with Google when the protected analysis workspace requests authentication.
3. Choose one of the four workflow categories.
4. Search for a place or draw the AOI.
5. Select the observation period and workflow-specific options.
6. Review the catalogue preflight and submit the processing request.
7. Follow the job status and open the resulting dashboard or result view.
8. Inspect the source products, acquisition dates, processing information, and map layers attached to the result.

The catalogue preflight is a discovery step; the processing worker runs the selected scientific workflow after a job is submitted.

## B. What to inspect in each workflow

### Find Displacements

Select a target-free AOI and date window. Review compatible GOFF products and any available GUNW pairwise diagnostics. Inspect candidate locations alongside product IDs, dates, quality information, and provenance.

### Glacier Movement

Select glacier terrain and an observation period. This category uses the shared displacement workflow and allows the reviewer to inspect candidate patterns in a glacier setting.

### Known Place Analysis

Choose a location, define a Measurement Polygon and a separate Reference Polygon, then submit the focused analysis. Review the polygon roles, selected source pairs, measurement outputs, and result provenance. The fixed author-exact P05023 research route is distinct from the generic two-polygon path.

### RiverShift

Draw a river-reach AOI and choose a date window. RiverShift searches for compatible GCOV dates, processes the selected observations, and displays the configured water/land screening classes:
- Blue: newly water-covered/open-water candidate.
- Red: persistent land-to-water transition candidate.
- Green: persistent water-to-land transition candidate.

Use the acquisition selector/playback to move between actual observation dates and inspect the source manifest and quality information.

## C. Exact active GitHub Actions entry points

The files below are the root-level executable workflow entry points in this repository. They are distinct from any dated workflow source snapshots under `migration/source-snapshots/`.

| User-facing workflow | Root-level entry point | Processing stage |
|---|---|---|
| Find Displacements | `.github/workflows/sarguardian-aoi-wkt-dashboard.yml` | `.github/workflows/sarguardian-aoi-dashboard-engine.yml` → `.github/workflows/sarguardian-aoi-product-worker.yml` |
| Glacier Movement | Same Find Displacements entry point | Same AOI-wide displacement processing chain; this is a glacier-oriented application category, not a separate processing engine |
| Known Place Analysis — user-defined polygons | `.github/workflows/know-place-aoi-dispatcher.yml` | `.github/workflows/know-place-aoi-analysis.yml` |
| Known Place — author-exact P05023 replay | `.github/workflows/know-place-paper-reproduction-dispatcher.yml` | `.github/workflows/know-place-author-exact-replay.yml` |
| RiverShift | `.github/workflows/river-shift-gcov-process.yml` | Dedicated GCOV processing workflow |

For the account Find Displacements path, the API dispatches the declared input contract to the root dashboard workflow. The dashboard engine discovers compatible products, runs one product worker per selected granule, validates product and remote-retention receipts, retries only items selected by the retry plan, and assembles the result. Inspect those workflow files in the current default branch rather than treating historical snapshots as active workflows.

```
## D. Inspect the implementation in this repository

| Review question | Source location |
|---|---|
| How the web app routes users | [apps/web/src/App.tsx](../../apps/web/src/App.tsx), [routing.ts](../../apps/web/src/routing.ts) |
| How the four workflows are presented | [engineData.ts](../../apps/web/src/data/engineData.ts), [Home.tsx](../../apps/web/src/pages/Home.tsx) |
| How the browser calls the API | [catalog.ts](../../apps/web/src/api/catalog.ts) |
| How API requests and jobs are handled | [apps/api/app](../../apps/api/app/) |
| How displacement analysis is implemented | [Find Displacements engine](../../engines/find-displacements/) |
| How Known Place analysis is implemented | [Known Place engine](../../engines/known-place/) |
| How RiverShift is implemented | [RiverShift engine](../../engines/river-shift/) |
| Supplementary NISAR detectability research | [Research README](../../science/nisar-core/README.md), [reproduction guide](../../science/nisar-core/REPRODUCE_RESULTS.md) — a separate research study, not a dependency of the four live workflows |
| Automated processing and validation | [GitHub Actions workflows](../../.github/workflows/) |

## E. Inspect automated processing

Open the [GitHub Actions history](https://github.com/shourov-04/SARGuardian/actions). Select the workflow relevant to the engine or request type, then inspect:

- the commit and branch that were executed;
- the workflow inputs and AOI/date parameters;
- product identifiers and acquisition dates;
- worker stages and validation steps;
- result manifests, checksums, and artifacts where available.

This lets a reviewer move from the public interface to the workflow implementation and its processing record. The Actions page contains the evolving workflow history; no single historical run is presented as the only evidence for a continuously developed application.

## F. Read the supporting documents

- [Project overview](PROJECT_OVERVIEW.md)
- [Datasets and references](DATASETS_AND_REFERENCES.md)
- [Scientific methods](SCIENTIFIC_METHODS.md)
- [AI usage disclosure](AI_USAGE.md)
- [Score-sheet evidence matrix](score-sheet-evidence-matrix.md)

## G. Guidance for AI-assisted review

Use the current default branch of this repository as the implementation source. Start with the root README and this guide, then follow the exact file paths above. Distinguish catalogue metadata, test fixtures, illustrative walkthrough panels, real NISAR observations, processing outputs, and independent reference datasets. When citing a result, state its product family, acquisition dates, AOI, and workflow/run context. Do not infer a measurement or validation metric that is not present in the result record.
