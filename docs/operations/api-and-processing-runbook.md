# SARGuardian API and processing runbook

This runbook describes the source-controlled API and workflow architecture in this repository. It is intended for local development, code review, and workflow troubleshooting.

## Local API

From `apps/api/`:

```bash
python -m venv .venv
# Activate the environment:
python -m pip install -r requirements.txt
cp .env.example .env
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Health endpoint: `GET /health`.

API tests:

```bash
python -m pytest -q
```

## Local web application

From `apps/web/`:

```bash
npm ci
npm run dev
npm run lint
npm run build
npm run test
```

Set the browser-safe Firebase and Maps configuration in `.env.local`. Use `VITE_SARGUARDIAN_API_URL` to point local web development at the API being tested. Never put server-side credentials in that file.

## Workflow source map

| Workflow family | Source |
|---|---|
| Find Displacements and AOI product workers | `.github/workflows/`, `engines/find-displacements/` |
| Known Place generic AOI workflows | `.github/workflows/know-place-*`, `engines/known-place/` |
| Known Place research replay | `.github/workflows/know-place-author-exact-replay.yml` and associated engine source |
| RiverShift GCOV processing | `.github/workflows/river-shift-gcov-process.yml`, `engines/river-shift/` |
| NISAR discovery and product handling | `.github/workflows/nisar-*`, relevant engine tools |
| Repository regression and secret scan | `.github/workflows/snapshot-regression-tests.yml`, `.github/workflows/historical-secret-scan.yml` |

## Processing lifecycle

1. Validate the authenticated request and request fingerprint.
2. Run catalogue discovery for the requested AOI and dates.
3. Apply workflow-specific product, geometry, orbit/frame, maturity, and native-layer checks.
4. Dispatch the processing workflow with the exact request snapshot.
5. Download and inspect only the selected compatible products.
6. Run the engine and produce derived outputs, QA records, and provenance manifests.
7. Assemble and publish the user-scoped result package.
8. Return worker status and result references through the API contract.

## Operational invariants

- Keep request identity and user ownership attached to jobs.
- Preserve signed callback verification and idempotent request handling.
- Treat catalogue discovery as preflight, not completed processing.
- Keep GOFF, GUNW, and GCOV measurement families distinct.
- Preserve actual acquisition dates; do not fill observation gaps with synthetic dates.
- Preserve failed-product retry behavior and final-stage failure propagation.
- Retain source hashes and product manifests wherever the worker contract provides them.
- Keep all credentials in server-side or GitHub Actions secret stores.

## Workflow inspection

Use the [repository Actions history](https://github.com/shourov-04/SARGuardian/actions) and select the workflow relevant to the engine and request type. Inspect the job steps, artifact manifest, product identifiers, acquisition dates, and the exact commit being executed. A successful run is evidence for the workflow and input it processed; do not generalise a single AOI result to every region or date.
