# Waste-Wise unified Web/PWA

This is the controlled-migration workspace for the Waste-Wise v2.0 unified responsive application. It intentionally lives alongside the legacy prototype while the production architecture is built out.

> **Current priority: Ahmedabad showcase prototype.** Add up to 10 of your own real dustbin addresses at `/setup`; their coordinates and details are stored only in the browser. The prototype needs no Google API key, Supabase project, or hardware. OpenStreetMap tiles and the public Nominatim one-at-a-time address lookup need an internet connection while setting up/presenting the map. Use `../../docs/NBA_SHOWCASE_SCRIPT.md` for the walkthrough.

## Current foundation

- Responsive role-aware surfaces for **Driver**, **Dispatcher**, and **HR / Admin**.
- A typed App Router PWA manifest, branded icons, conservative application-shell service worker, and local offline-outbox primitive.
- Supabase browser/server/proxy helpers that enter a safe local-preview mode until public environment values are supplied.
- Typed API input contracts for collection proof, hazards, SOS, and telemetry.
- A version-controlled Supabase tenant/RBAC/RLS baseline in `../../supabase`.

Your configured bin IDs, addresses, coordinates, fill levels, and capacity notes are real local showcase records. Route ordering, fleet, payroll, alert, and field-action behavior remain presentation-only until the production services are connected.

## Run locally

```bash
cp .env.example .env.local # optional; omit values to use preview mode
npm install
npm run dev -- --hostname 0.0.0.0
```

Open `http://localhost:3000` locally, or use the Arena live preview. Visit `/setup` first to enter real dustbin IDs, names, addresses, fill levels, and optional capacity. Select **Locate** to geocode each address, check its pin, save, and then open `/dispatch`.

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
