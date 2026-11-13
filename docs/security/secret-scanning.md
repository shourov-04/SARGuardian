# SARGuardian secret-scanning record

## Latest full-history repository scan

The **Historical Secret Scan** workflow completed successfully against the exact current `main` commit:

- Repository: [shourov-04/SARGuardian](https://github.com/shourov-04/SARGuardian)
- Branch: `main`
- Scanned commit: `a5c184d9307d307b8f99d89804e8569b9bc2a416`
- Workflow run: [43448237561 — Historical Secret Scan](https://github.com/shourov-04/SARGuardian/actions/runs/43448237561)
- Run date: 13 November 2026 (UTC)
- Scanner: pinned Gitleaks 8.30.1
- History inspected: **2,879 commits** reachable from the refs fetched by the workflow
- Scan volume: approximately 32.09 MB
- Result: **PASS — zero findings**

The workflow log confirms the exact checkout SHA, successful completion of the full-history scan, `SECRET_SCAN_FINDING_COUNT=0`, and `SECRET_SCAN_PASS`.

## What this check establishes

This run establishes that the configured Gitleaks scan found no matching secrets in the repository history reachable from the refs fetched for this run. It is a repository-security control, not a guarantee that credentials have never been exposed elsewhere or that every external service is correctly configured.

Open the [workflow run](https://github.com/shourov-04/SARGuardian/actions/runs/43448237561) to inspect the scan result and job log.

## Ongoing handling

- Keep API tokens, Earthdata credentials, Firebase Admin JSON, Supabase server keys, Drive OAuth credentials, callback secrets, and signed URLs out of commits and logs.
- Use placeholder-only values in example configuration files.
- Do not paste secret values into issues, pull requests, job summaries, or generated artifacts.
- Rotate a provider credential at its source if a real value is ever exposed; removing it from the latest file is not sufficient.
- Re-run the repository secret scan after material history or configuration changes and inspect the result attached to the exact commit.
