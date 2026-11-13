# SARGuardian API

This folder contains the FastAPI application implementation used by the SARGuardian web/API architecture. The API handles authenticated catalogue preflight, user-scoped job requests and status, dispatch coordination, callbacks, and retrieval of result packages.

## Local setup

Use Python 3.12 or the version declared in the API's dependency/environment files. From this directory:

```bash
python -m venv .venv
# Activate the environment, then:
python -m pip install -r requirements.txt
cp .env.example .env
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Health endpoint: `GET /health`.

## Main API responsibilities

- Validate the authenticated Firebase identity before user-scoped requests.
- Validate AOI geometry, date windows, product families, and request contracts.
- Search NISAR catalogue metadata through ASF/NASA CMR adapters.
- Create and track displacement and Known Place processing requests.
- Expose RiverShift catalogue, job, retry, and result routes.
- Coordinate GitHub Actions dispatch and signed worker callbacks.
- Retrieve result artifacts and interactive dashboard content for the authenticated owner.

The exact route definitions and request/response models are in `app/main.py`, `app/displacements.py`, `app/known_place.py`, `app/river_shift.py`, and `app/river_shift_jobs.py`.

## API and workflow distinction

Catalogue endpoints are preflight/discovery operations: they describe matching products and do not represent a completed scientific analysis. The processing workflow is a separate job lifecycle. A successful dispatch confirms that the job was accepted by the orchestration path; the worker's result manifest and processing record describe the completed work.

## Authentication and persistence

- Firebase ID tokens authenticate browser requests.
- Firebase Admin verifies identity on the server.
- Server-side persistence stores user-scoped job state and request snapshots.
- Worker callbacks are checked against the configured callback contract before status/result records are updated.

## Server-side configuration

The exact environment variable names are listed in `.env.example` and parsed in `app/config.py`. Keep the following categories server-side:

- Firebase Admin identity configuration.
- Supabase server connection and secret key.
- GitHub Actions dispatch token, repository/workflow/ref settings, and callback secrets.
- Earthdata credentials used by workers.
- Google Drive OAuth credentials and private result-storage configuration.
- CORS origin configuration and public API base URL used for signed callbacks.

Never commit actual values in `.env`, source files, logs, artifacts, or documentation. Never expose server credentials through a browser `VITE_*` variable.

## Tests

```bash
python -m pytest -q
```

Use the relevant GitHub Actions workflow tests when changing dispatch payloads, callback signatures, workflow names, result manifests, retention behavior, or authentication contracts. See [repository operations guidance](../../docs/operations/api-and-processing-runbook.md).
