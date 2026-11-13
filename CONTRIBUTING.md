# Contributing to SARGuardian

SARGuardian combines a React/TypeScript web application, a FastAPI API layer, NISAR processing engines, scientific modules, and GitHub Actions automation.

## Before changing code

1. Read [AGENTS.md](AGENTS.md), [system architecture](docs/architecture/system-boundaries.md), and the relevant engine documentation.
2. Identify the workflow and product family affected by the change.
3. Trace the browser/API request, Actions workflow, engine entry point, result contract, and UI consumer before changing a processing path.
4. Preserve the distinction between GOFF, GUNW, and GCOV.
5. Keep user-visible names consistent with the four project workflows.

## Pull requests

- Use a focused branch and a descriptive pull-request title.
- Explain the user-visible or scientific behaviour being changed.
- Link the relevant source paths and tests.
- Describe any API, workflow input, callback, artifact, or data-manifest contract change.
- Include before/after screenshots for material UI changes when available.
- Never include credentials, service-account files, private result URLs, raw user data, or large raw NISAR products.

## Verification

Run the checks relevant to the changed area:

**Web application**
- From `apps/web/`: `npm ci`
- `npm run lint`
- `npm run build`
- `npm run test`

**API**
- From `apps/api/`: install `requirements.txt`
- `python -m pytest -q`

**Scientific engines**
- Run the targeted pytest suite under the engine's `tests/` or `tools/*/tests/` directory.
- Validate modified workflow YAML and action contracts.
- Where a change affects real product handling, preserve product manifests, native layer checks, source hashes, and output provenance.

A passing unit test proves the tested software contract. Keep that result distinct from satellite-product QA and independent geophysical validation.

## Documentation

Update the relevant document under `docs/` or the engine directory whenever implementation, routes, product inputs, or reviewer instructions change. Keep `docs/migration/` as a dated historical archive; do not use migration records as current setup instructions.
