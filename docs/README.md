# SARGuardian documentation index

This index is the navigation layer for human reviewers, developers, and AI-assisted reviewers. The current public project is [shourov-04/SARGuardian](https://github.com/shourov-04/SARGuardian); the live application is https://sarguardian.vercel.app/.

## Recommended review order

1. [Project overview](submission/PROJECT_OVERVIEW.md) — what SARGuardian is and where to begin.
2. [Reviewer guide](submission/REVIEWER_GUIDE.md) — how to run the live application and inspect the matching source.
3. [Datasets and references](submission/DATASETS_AND_REFERENCES.md) — NISAR products, service references, and how each is used.
4. [Scientific methods](submission/SCIENTIFIC_METHODS.md) — measurement families, processing flow, provenance, and interpretation.
5. [AI usage](submission/AI_USAGE.md) — development and media-production disclosure.
6. [Score-sheet evidence matrix](submission/score-sheet-evidence-matrix.md) — where each rubric category is supported in the product and source.

## Current technical documentation

| Area | Document or source |
|---|---|
| System architecture | [System boundaries](architecture/system-boundaries.md) |
| Web application | [Web README](../apps/web/README.md) |
| Web tests and live review | [Web validation guide](../apps/web/VALIDATION.md) |
| API implementation | [API README](../apps/api/README.md) |
| API operational workflow | [Active API runbook](operations/api-and-processing-runbook.md) |
| Secret handling | [Deployment and secret map](operations/deployment-and-secret-map.md) |
| Secret scan result | [Secret scanning record](security/secret-scanning.md) |
| Displacement science | [Find Displacements methods](scientific-validation/find-displacements/README.md) |
| RiverShift engine | [RiverShift README](../engines/river-shift/tools/river_shift/README.md) |
| Known Place engine | [Known Place README](../engines/known-place/README.md) |

## Supplementary scientific research

- [NISAR detectability study](../science/nisar-core/README.md) — a self-contained, reproducible Langtang Lirung research analysis. It provides additional scientific context and reproducibility material; it is not a runtime dependency of Find Displacements, Glacier Movement, Known Place Analysis, or RiverShift.

## Historical records

- [Migration archive index](migration/README.md) describes the dated source-import and migration records under this directory.
- `docs/migration/` contains historical audit snapshots, import maps, source pins, and migration-era deployment inventories.
- `migration/source-snapshots/` preserves source snapshots for lineage and reproducibility.
- Dated workflow evidence and per-run research records remain in their engine-specific evidence directories.

Historical records are intentionally preserved. For current product behavior and reviewer instructions, start with the canonical submission documents and current source paths above rather than treating every dated report as a present-day status statement.
