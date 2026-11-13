# Web application verification guide

This document describes the checks available in the repository and the live review path.

## Automated checks

Run from `apps/web/`:

```bash
npm ci
npm run lint
npm run build
npm run test
```

The test suite includes routing, Firebase configuration and authentication gating, dashboard behavior, Google Maps loader behavior, RiverShift AOI parsing, manifest validation, overlay layers, and processing/results page contracts.

## Workflow verification path

For an end-to-end review, use the public application and a user-selected AOI/date window:

1. Open https://sarguardian.vercel.app/.
2. Sign in through the displayed Google authentication flow when prompted.
3. Select one of the four analysis workflows.
4. Define the AOI and observation window requested by that workflow.
5. Review catalogue matches and the processing request before submitting.
6. Follow the job's actual processing state.
7. Inspect the returned maps and the source product/acquisition/provenance information attached to the result.

A catalogue preflight is a discovery stage. A processing result is produced by the selected workflow worker, not by the metadata search response.

## Source paths for review

- Main application and routing: `src/App.tsx`, `src/routing.ts`
- Workflow cards: `src/data/engineData.ts`, `src/pages/Home.tsx`
- Authenticated API calls: `src/api/catalog.ts`
- AOI and map behavior: `../landslide/ui/`, `src/riverShift/`
- Processing workflows: `../../.github/workflows/`, `../../engines/`

## Interpreting automated results

Web tests validate client-side contracts and expected UI behavior. GitHub Actions workflow checks validate their configured software and data contracts. Product-level processing records provide acquisition and provenance context. Keep these evidence types distinct when describing a result.
