# Waste-Wise unified Web/PWA

This is the controlled-migration workspace for the Waste-Wise v2.0 unified responsive application. It intentionally lives alongside the legacy prototype while the production architecture is built out.

> **Current priority: Ahmedabad showcase prototype.** Add up to 10 of your own real dustbin addresses at `/setup`; their coordinates and details are stored only in the browser. The prototype needs no Google API key, Supabase project, or hardware. OpenStreetMap tiles and the public Nominatim one-at-a-time address lookup need an internet connection while setting up/presenting the map. Use `../../docs/NBA_SHOWCASE_SCRIPT.md` for the walkthrough.

## Current foundation

- Responsive role-aware surfaces for **Driver**, **Dispatcher**, and **HR / Admin**.
- A typed App Router PWA manifest, branded icons, conservative application-shell service worker, and local offline-outbox primitive.
- Supabase browser/server/proxy helpers that enter a safe local-preview mode until public environment values are supplied.
- Typed API input contracts for collection proof, hazards, SOS, and telemetry.
- A version-controlled Supabase tenant/RBAC/RLS baseline in `../../supabase`.

Your configured bin IDs, addresses, coordinates, fill levels, and capacity notes are real local showcase records. The draft checks manual high-fill bins first, then uses local straight-line proximity. The working showcase sequence is **setup → dispatcher draft → driver/vehicle label assignment → published route → started shift → resolved stops → Admin review/export**. Driver outcomes, exception notes, safety reports, and shift timestamps persist locally so the next workspace sees the same hand-off. They remain presentation-only until production services are connected.

## Run locally

```bash
cp .env.example .env.local # optional; omit values to use preview mode
npm install
npm run dev -- --hostname 0.0.0.0
```

Open `http://localhost:3000` locally, or use the Arena live preview. Visit `/setup` first to enter real dustbin IDs, names, addresses, fill levels, and optional bin-capacity display notes. Select **Locate** to geocode each address, verify its pin, and save. In `/dispatch`, build a draft, enter non-sensitive Driver and Vehicle labels, then publish the route. The Driver must start the local shift before seeing stops; resolve every stop before ending it. `/admin` reviews the shared route record and enables a local execution CSV after completion.

## Quality checks

```bash
npm run lint
npm test
npm run build
```

## Environment rules

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are browser-safe public values. Never put a Supabase service-role key, routing-provider secret, device credential, or telemetry-ingestion secret in `.env.local` values exposed to browser code.

## Delivery boundary

This foundation is intentionally not yet connected to a live database, notifications, hardware ingestion, GPS-radius proof, real road-matrix provider, production vehicle registry, server-side role authorization, or payroll policy. The Admin CSV is an execution showcase export—not payroll. See `../../docs/COMPLETION_RESEARCH_AND_EXECUTION_PLAN.md` for the approved staged delivery plan and the mandatory Surat routing-provider validation spike.
