# SARGuardian — repository and review guide

This file is the repository-level operating context for coding assistants and human contributors. The canonical public project is **shourov-04/SARGuardian**. Start with the root README and the current documents under `docs/submission/`.

## Canonical project entry points

- Live application: https://sarguardian.vercel.app/
- Primary source repository: https://github.com/shourov-04/SARGuardian
- Actions history: https://github.com/shourov-04/SARGuardian/actions
- Reviewer guide: `docs/submission/REVIEWER_GUIDE.md`
- Scientific methods: `docs/submission/SCIENTIFIC_METHODS.md`
- Data sources: `docs/submission/DATASETS_AND_REFERENCES.md`

When reviewing the project, use the current default branch and cite exact file paths, workflow names, product identifiers, and observed dates. The `docs/migration/` directory and `migration/source-snapshots/` preserve dated historical records; they are lineage evidence, not the current product overview or current operating guide.

## Product and engine boundaries

- **Find Displacements** is target-free AOI-wide candidate discovery. It does not require a user-specified target point.
- **Glacier Movement** is a user-facing analysis category that uses the shared displacement workflow. Do not describe it as an independent glacier-collapse physics engine.
- **Known Place Analysis** is a focused two-polygon workflow. Keep the Measurement Polygon and Reference Polygon roles distinct. Its author-exact research route is separate from generic AOI analysis.
- **RiverShift** is the GCOV-based river and water/land change workflow. Keep its source products and QA chain separate from GOFF/GUNW displacement measurements.

## Scientific evidence rules

- GOFF offsets and GUNW phase/LOS are different measurement families; never merge their values or units.
- A GOFF anomaly is a candidate signal, not proof of a landslide or confirmed ground movement.
- Pairwise GUNW LOS is not automatically cumulative displacement or three-dimensional motion.
- GCOV-derived RiverShift classes are screening candidates; label them as observed radar-derived transitions.
- Playback represents actual acquisition dates, not interpolation or forecast.
- Preserve source product IDs, acquisition dates, processing maturity, geometry, valid-pixel support, checksums, and workflow provenance when available.
- A processing PASS describes the checks completed by that workflow; do not relabel it as independent geophysical validation.
- Missing or withheld measurements are not zero.

## Implementation and security

- Keep browser code in `apps/web/`, API code in `apps/api/`, runtime processing engines in `engines/`, and automated workflows in `.github/workflows/` or engine-local workflow directories. `science/nisar-core/` is a supplementary reproducible detectability research study, not an imported runtime dependency of the four user-facing workflows.
- The web client obtains a Firebase ID token and sends authenticated requests through the configured API origin. Do not expose server credentials in browser code.
- GitHub Actions workers receive their credentials from repository/environment secret stores. Never commit tokens, passwords, service-account JSON, callback secrets, private result URLs, or raw private user data.
- Do not change production routing, callback destinations, database schema, or secret names as incidental documentation or UI cleanup.
- Preserve retry, cancellation, idempotency, request-fingerprint, callback-signature, and result-retention contracts.
- Do not weaken source-integrity, QA, or validation gates to make a check pass.

## Change and verification workflow

1. Read the relevant canonical docs and the implementation before changing behavior.
2. Keep changes scoped to the requested UI, API, engine, or documentation area.
3. Add or update tests for changed behavior.
4. Run the applicable lint, type-check, build, and test commands where the execution environment permits.
5. Inspect the current GitHub Actions results for the exact commit; distinguish a successful secret scan from a full regression run.
6. Update documentation when a route, workflow contract, data family, or user-visible behavior changes.

## Reviewer-facing writing

Use clear capability-first descriptions supported by source code and actual workflow behaviour. Explain what each dataset measures and where it is used. Keep application examples, illustrative media, test fixtures, satellite observations, and processing outputs clearly distinguishable. Do not invent metrics, user outcomes, coverage, scientific validation, or score results.
