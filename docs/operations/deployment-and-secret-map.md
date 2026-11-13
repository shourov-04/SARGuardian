# Runtime configuration and secret-handling map

This document describes configuration responsibilities in the source repository. It does not contain production secret values.

## Configuration layers

| Layer | Configuration examples | Handling |
|---|---|---|
| Web browser | Firebase web configuration, Google Maps browser key, API origin | Intended for browser exposure; restrict provider keys by origin/API |
| API server | Firebase Admin identity, Supabase server credentials, API CORS settings | Server-side only |
| GitHub Actions | Workflow dispatch token, Earthdata access, Drive OAuth, callback secrets | Repository/environment secret stores only |
| Processing worker | Product selection, AOI/date request, retention and output options | Passed through validated workflow inputs and job manifests |
| Result delivery | Result references, manifest digests, private storage receipts | Owner-scoped and authenticated |

## Browser configuration

The browser reads the public variables documented in `apps/web/.env.example`. Only values deliberately designed for browser use may use the `VITE_*` prefix. Never place server credentials in that file.

## API configuration

The API reads server-side settings defined in `apps/api/app/config.py` and illustrated by `apps/api/.env.example`. Keep Firebase Admin credentials, Supabase service keys, GitHub Actions tokens, callback secrets, Earthdata credentials, and Drive OAuth values out of the web bundle and source control.

## GitHub Actions configuration

Processing workflows may require:
- Earthdata Login credentials or a supported Earthdata token.
- Google Drive OAuth client and refresh credentials for private result delivery.
- The configured Drive parent folder identifier.
- API callback URL and per-workflow callback secret.
- A GitHub token with only the repository/workflow permissions needed by the dispatcher.

Use the exact variable names expected by the workflow and adapter. Do not create aliases casually: workflow and API configuration names are contracts.

## Safe change procedure

1. Read the consuming code in `apps/api/app/config.py`, the relevant dispatcher, and the workflow YAML.
2. Identify whether a value is a secret, a public setting, or a repository variable.
3. Change the source contract and its tests together.
4. Update examples with placeholders only; never copy a live value into a sample file.
5. Inspect the resulting GitHub Actions logs to ensure secret values are not printed.
6. Confirm the web bundle contains no server-side credentials.

## Repository security baseline

The public repository includes a full-history secret scan workflow. The latest inspected successful baseline is documented in [secret scanning](../security/secret-scanning.md). That result applies to the scanned commit and reachable history at that point in time.
