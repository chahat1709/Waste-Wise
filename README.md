<div align="center">

# ♻️ Waste-Wise

### Unified waste-collection operations Web/PWA — Ahmedabad showcase prototype

[![Status](https://img.shields.io/badge/status-NBA%20showcase%20prototype-176b50?style=for-the-badge)](apps/web)
[![Prototype scope](https://img.shields.io/badge/scope-up%20to%2010%20real%20bins-0b7a59?style=for-the-badge)](apps/web/src/app/setup/page.tsx)
[![Maps](https://img.shields.io/badge/maps-OpenStreetMap-7f8c8d?style=for-the-badge)](https://www.openstreetmap.org/)

</div>

## Current status

Waste-Wise is **approximately 10% complete**. The active deliverable is a responsive NBA showcase prototype in [`apps/web`](apps/web), built around a single role-aware Web/PWA experience for:

- **Dispatcher** — validates real-bin map pins, creates a reviewable local route draft, assigns a Driver/Vehicle showcase label, publishes it, and reviews local field hand-offs.
- **Driver** — can start only a published assignment, then records collection or exception outcomes (with reasons), road hazards, and SOS locally before ending the shift.
- **HR / Admin** — reviews the shared route/shift record, real-bin registry, exceptions, and a local execution CSV while honestly marking accounts, payroll, and vehicle registry as future work.

The approved product direction is documented in [`PRD.md`](PRD.md). The staged production plan is in [`docs/COMPLETION_RESEARCH_AND_EXECUTION_PLAN.md`](docs/COMPLETION_RESEARCH_AND_EXECUTION_PLAN.md).

## Showcase with your real dustbin locations

1. Run the web application.
2. Open **`/setup`** or select **Configure real bins**.
3. Add up to **10 real Ahmedabad dustbin addresses** with IDs, names, manual fill levels, and optional bin-capacity notes (display only).
4. Locate each address and verify its pin on OpenStreetMap.
5. Open **Dispatch** to build a local draft, enter non-sensitive Driver and Vehicle labels, and publish the hand-off.
6. Start the Driver shift, resolve every stop, then review or download the local execution record in **HR / Admin**.

The setup records stay in the current browser's local storage and can be downloaded as JSON before a presentation. See [`docs/NBA_SHOWCASE_SCRIPT.md`](docs/NBA_SHOWCASE_SCRIPT.md) for the presenter-ready walkthrough.

## Run the active app

```bash
cd apps/web
npm install
npm run dev -- --hostname 0.0.0.0
```

Open `http://localhost:3000`, then visit `/setup` first.

Quality checks:

```bash
npm run lint
npm test
npm run build
```

## Honest prototype boundary

- The configured dustbin addresses, coordinates, names, fill levels, and capacity notes are **user-entered local showcase records**, not mock bin records.
- OpenStreetMap tiles and the public Nominatim one-at-a-time address lookup require internet access while maps/locations are being used. No Google Maps or Google routing API is used.
- The current route action checks manually entered high-fill bins first, then creates a local straight-line proximity draft. It becomes a local Driver hand-off only after a Driver and Vehicle label are entered and Dispatch publishes it; it is **not** road routing, traffic-aware ETA, truck-safe routing, capacity optimization, CVRP, or live dispatch.
- Fill levels, shift timestamps, stop outcomes, exception notes, hazards, and SOS reports are manually recorded locally. There is no live sensor ingestion, telemetry, live vehicle GPS, production notification, or backend persistence yet.
- The Admin CSV is a local execution record, not payroll. Workforce accounts, wage calculations, vehicle registry, and server-side role authorization remain future work.

## Repository layout

```text
apps/web/                   Active unified Next.js Web/PWA showcase
  src/app/setup/            Real-bin address, coordinate, and map-pin setup
  src/app/dispatch/         Dispatcher experience
  src/app/driver/           Driver experience
  src/app/admin/            HR / Admin experience
supabase/migrations/        Version-controlled production-foundation schema
PRD.md                      Approved product requirements
/docs                       Delivery research and NBA showcase script

# Legacy reference prototype files remain at the repository root.
# They are not the active showcase implementation or production source of truth.
```

## Production next steps

The showcase establishes the workflow, not production operations. The next implementation stages are authenticated tenant-aware data storage, trusted sensor/device ingestion, real driver location and notification flows, and an Ahmedabad/Surat-validated road-routing plus CVRP provider integration. Provider credentials and operational secrets must remain server-side.
