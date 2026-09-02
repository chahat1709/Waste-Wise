<div align="center">

# ♻️ Waste-Wise

### Unified waste-collection operations Web/PWA — Ahmedabad showcase prototype

[![Status](https://img.shields.io/badge/status-NBA%20showcase%20prototype-176b50?style=for-the-badge)](apps/web)
[![Prototype scope](https://img.shields.io/badge/scope-up%20to%2010%20real%20bins-0b7a59?style=for-the-badge)](apps/web/src/app/setup/page.tsx)
[![Maps](https://img.shields.io/badge/maps-OpenStreetMap-7f8c8d?style=for-the-badge)](https://www.openstreetmap.org/)

</div>

## Current status

Waste-Wise is **approximately 10% complete**. The active deliverable is a responsive NBA showcase prototype in [`apps/web`](apps/web), built around a single role-aware Web/PWA experience for:

- **Dispatcher** — real-bin map pins, manually entered fill levels, local route ordering, and a Driver hand-off.
- **Driver** — clock-in/out, real configured stop sequence, collection/skip actions, road-hazard reporting, and SOS interaction states.
- **HR / Admin** — configured-bin registry plus presentation-only account, shift, payroll, and vehicle-management surfaces.

The approved product direction is documented in [`PRD.md`](PRD.md). The staged production plan is in [`docs/COMPLETION_RESEARCH_AND_EXECUTION_PLAN.md`](docs/COMPLETION_RESEARCH_AND_EXECUTION_PLAN.md).

## Showcase with your real dustbin locations

1. Run the web application.
2. Open **`/setup`** or select **Configure real bins**.
3. Add up to **10 real Ahmedabad dustbin addresses** with IDs, names, manual fill levels, and optional capacities.
4. Locate each address and verify its pin on OpenStreetMap.
5. Open **Dispatch** to build the local visit sequence, then publish it to **Driver**.

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
- The current route action is a local, straight-line proximity ordering. It is **not** road routing, traffic-aware ETA, truck-safe routing, CVRP optimization, or live driver dispatch.
- Fill levels are manually entered for the presentation. There is no live sensor ingestion, telemetry, live vehicle GPS, production notification, or backend persistence yet.
- Workforce, fleet, payroll, hazard, and SOS interactions are clearly presentation-only until the planned authenticated backend and integrations are delivered.

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
