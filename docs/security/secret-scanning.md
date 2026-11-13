# SARGuardian secret-scanning record

## Current repository scan

The GitHub Actions workflow **Historical Secret Scan** completed successfully for the public repository's main commit:

- Repository: [shourov-04/SARGuardian](https://github.com/shourov-04/SARGuardian)
- Scanned commit: `e9a346a4553780d2a43442892298daa7a4850163`
- Workflow run: [43400901832 — Historical Secret Scan](https://github.com/shourov-04/SARGuardian/actions/runs/43400901832)
- Scanner: pinned Gitleaks 8.30.1
- History inspected: 2,836 reachable commits
- Result: **PASS — no Gitleaks findings in the scanned reachable history**

The scan log records `SECRET_SCAN_FINDING_COUNT=0` and `SECRET_SCAN_PASS`.

## What this check establishes

The workflow scans the repository history reachable from the fetched refs at the scanned commit. Its successful result is a useful repository-security control and can be independently opened from the Actions link above.

## Ongoing handling

- Keep all API tokens, Earthdata credentials, Firebase Admin JSON, Supabase server keys, Drive OAuth credentials, callback secrets, and signed URLs out of commits and logs.
- Use placeholder-only values in example configuration files.
- Do not paste secret values into issues, pull requests, job summaries, or generated artifacts.
- Rotate a provider credential at its source if a real value is ever exposed; removing it from the latest file is not sufficient.
- Run the repository secret scan after material history or configuration changes and inspect the result attached to the exact commit.
