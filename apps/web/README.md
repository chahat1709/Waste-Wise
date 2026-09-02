# Waste-Wise unified Web/PWA

This is the controlled-migration workspace for the Waste-Wise v2.0 unified responsive application. It intentionally lives alongside the legacy prototype while the production architecture is built out.

## Current foundation

- Responsive role-aware surfaces for **Driver**, **Dispatcher**, and **HR / Admin**.
- A typed App Router PWA manifest, branded icons, conservative application-shell service worker, and local offline-outbox primitive.
- Supabase browser/server/proxy helpers that enter a safe local-preview mode until public environment values are supplied.
- Typed API input contracts for collection proof, hazards, SOS, and telemetry.
- A version-controlled Supabase tenant/RBAC/RLS baseline in `../../supabase`.

The dashboard records are visibly marked local pilot data. They are not production telemetry, route plans, payroll, or persisted field actions.

## Run locally

```bash
cp .env.example .env.local # optional; omit values to use preview mode
npm install
npm run dev -- --hostname 0.0.0.0
```

Open `http://localhost:3000` locally, or use the Arena live preview.

## Quality checks

```bash
npm run lint
npm test
npm run build
```

## Environment rules

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are browser-safe public values. Never put a Supabase service-role key, routing-provider secret, device credential, or telemetry-ingestion secret in `.env.local` values exposed to browser code.

## Delivery boundary

This foundation is intentionally not yet connected to a live database, notifications, hardware ingestion, real road-matrix provider, or production payroll policy. See `../../docs/COMPLETION_RESEARCH_AND_EXECUTION_PLAN.md` for the approved staged delivery plan and the mandatory Surat routing-provider validation spike.
