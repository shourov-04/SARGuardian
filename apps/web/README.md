# SARGuardian web application

**Live application:** https://sarguardian.vercel.app/  
**Primary source:** [shourov-04/SARGuardian](https://github.com/shourov-04/SARGuardian)

This folder contains the React, TypeScript, and Vite application used as the public SARGuardian interface. It provides the map and AOI experience, account sign-in, workflow selection, processing status views, dashboards, and result exploration.

## User-facing workflows

- **Find Displacements:** AOI-wide candidate discovery using GOFF offsets and separately presented GUNW diagnostics.
- **Glacier Movement:** a glacier-oriented entry into the shared displacement workflow.
- **Known Place Analysis:** focused analysis with distinct Measurement and Reference polygons.
- **RiverShift:** an AOI-driven, multi-date GCOV river and surface-water change workflow.

The app routes are defined in `src/routing.ts`; route and authentication integration is in `src/App.tsx`; the four workflow entries are registered in `src/data/engineData.ts`.

## Request and processing flow

1. Firebase Authentication provides the signed-in user's ID token.
2. The browser sends authenticated requests to the API origin resolved in `src/api/apiOrigin.ts`.
3. Catalogue preflight requests return matching granule metadata and are explicitly marked as catalogue-only.
4. A confirmed processing request is submitted through the job API.
5. The API coordinates the relevant GitHub Actions workflow; the processing worker runs the selected engine and reports job status and result information.
6. The app retrieves the user's job and result bundle through authenticated API calls and displays its maps and provenance.

The browser is the interaction layer; scientific processing runs in the engine/workflow layer. The API origin may be set using `VITE_SARGUARDIAN_API_URL`; the source fallback is defined in `src/api/apiOrigin.ts`.

## Local development

Use Node.js 22 or newer. From this directory:

```bash
npm ci
npm run dev
```

Vite serves the application at `http://localhost:5173`.

## Quality checks

```bash
npm run lint
npm run build
npm run test
```

The package scripts are declared in `package.json`. Tests are colocated with routing, authentication, AOI validation, dashboard, RiverShift, and UI modules.

## Browser configuration

Copy `.env.example` to `.env.local` for local work and provide the required public browser configuration:

- Firebase web configuration: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, and `VITE_FIREBASE_APP_ID`.
- Google Maps browser key: `VITE_GOOGLE_MAPS_API_KEY`, restricted to the intended website origins and APIs.
- API origin override: `VITE_SARGUARDIAN_API_URL`.

Only browser-safe values belong in `VITE_*` variables. Never put Firebase Admin JSON, Supabase server keys, GitHub tokens, Earthdata credentials, Drive OAuth credentials, or callback secrets in the frontend environment.

## Source map

- `src/pages/` — home, workflow setup, processing, results, archive, and explanatory pages.
- `src/api/catalog.ts` — authenticated API contracts for catalogue discovery, jobs, dashboards, and RiverShift.
- `src/riverShift/` — RiverShift AOI, manifest, overlay, and result-presentation helpers.
- `../landslide/ui/` — shared AOI map, displacement, and Known Place interface components.
- `../landslide/engine/` — client-side geometry and request validation.
- `../../engines/` — server-side scientific processing engines and workflow sources.

See [web validation and test guide](VALIDATION.md) and the [reviewer guide](../../docs/submission/REVIEWER_GUIDE.md).
