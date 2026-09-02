# Waste-Wise v2.0 — Completion Research & Execution Plan

| Field | Value |
| --- | --- |
| Status | Technical research and delivery plan |
| Based on | `PRD.md` v2.0 and a static audit of the current repository |
| Current baseline | Approximately 10% of the P0 product is complete |
| Recommended approach | Controlled rebuild/migration into one role-aware PWA; do **not** keep extending the disconnected static-page prototype |
| Scope | Municipal and private waste-collection operations |

> **Decision in one sentence:** Build one responsive Next.js PWA backed by a secure Node/Express API, Supabase Auth/Postgres, a separately deployable Python OR-Tools optimizer, and a routing-provider adapter; retain useful product ideas from the legacy code, but replace its runtime, data, authorization, and deployment foundations.

---

## 1. Research conclusion

The repository contains valuable proof-of-concept assets: Firebase login screens, static admin/driver interfaces, Express/Socket.IO endpoints, a Python routing prototype, Leaflet mapping, and tentative Supabase/Mappls hooks. It does **not** yet contain the v2.0 foundation needed for a municipal pilot:

- no unified Next.js/React PWA, manifest, service worker, or offline write queue;
- no migration-managed database schema or row-level role policies;
- no server-enforced authorization for operational endpoints;
- no secure device identity or MQTT ingestion path;
- no production-valid truck/traffic/avoid-area routing pipeline;
- no shift, payroll, GPS-radius proof, SOS, or road-hazard lifecycle; and
- no automated test, CI, deployment, monitoring, or recovery setup.

The fastest safe path is **not** a page-by-page repair of the old HTML files. It is a staged replacement that preserves the domain concepts and validates every P0 flow end-to-end.

### What to retain vs. replace

| Current asset | Decision | Reason |
| --- | --- | --- |
| Product vocabulary, bin/route/alert concepts, visual ideas | **Retain** | Useful discovery work and domain direction. |
| `cvrp_solver.py` concepts | **Refactor/test** | It provides a starting point, but must support real matrix data, weight + volume dimensions, infeasibility, time limits, and no silent straight-line production fallback. |
| Express/Socket.IO event intent | **Rebuild behind typed contracts** | Real-time events are appropriate; current endpoints and auth boundaries are not production-ready. |
| Static HTML/CSS/vanilla JS dashboards | **Replace gradually** | They conflict with the one-app PWA requirement and duplicate role behavior. |
| Firebase plus Supabase dual identity setup | **Consolidate to Supabase Auth** | v2.0 specifies Supabase Auth. One identity source avoids split sessions and mismatched role checks. |
| In-memory route/alert/collection fallback | **Remove as a source of truth** | Durable Postgres records and idempotent writes are mandatory for operations and payroll. |

---

## 2. Recommended target architecture

“Single unified application” means a single user-facing web/PWA experience. It does **not** require putting every backend concern in one process.

```text
┌──────────────────────────────────────────────────────────────────────┐
│                  Waste-Wise Next.js PWA (one web app)                │
│  role-aware routes: /driver · /dispatch · /admin                     │
│  TypeScript · Tailwind · offline outbox · service worker · web push  │
└───────────────┬──────────────────────────┬───────────────────────────┘
                │ HTTPS / REST             │ Socket.IO
                ▼                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   Node.js / Express operational API                  │
│  Supabase JWT verification · RBAC · OpenAPI validation · audit logs  │
│  telemetry ingress · alert engine · dispatch API · notification API  │
└───────┬──────────────────────┬──────────────────────┬────────────────┘
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐     ┌────────────────┐     ┌─────────────────────────┐
│ Supabase      │     │ Python optimizer│     │ Routing-provider adapter│
│ Auth/Postgres │     │ FastAPI +       │     │ Mappls primary spike /  │
│ RLS, storage  │     │ OR-Tools        │     │ HERE fallback candidate │
└───────────────┘     └────────────────┘     └─────────────────────────┘
        ▲                      ▲
        │                      │
┌───────┴──────────────────────┴──────────────────────────────────────┐
│ Device gateway: HTTPS first, then MQTT over TLS/mTLS for pilot scale │
│ ESP32 → authenticated device topic/endpoint → validation → telemetry │
└──────────────────────────────────────────────────────────────────────┘
```

### Repository layout to target

```text
Waste-Wise/
├── apps/
│   └── web/                    # Next.js App Router PWA; all user views
├── services/
│   ├── api/                    # Express + Socket.IO operational API
│   └── optimizer/              # FastAPI/Python/OR-Tools service
├── packages/
│   ├── contracts/              # shared Zod/OpenAPI-generated types
│   └── ui/                     # shared role-aware UI primitives (optional)
├── supabase/
│   ├── migrations/             # versioned SQL, RLS policies, functions
│   ├── seed.sql                # non-production demo/test data
│   └── tests/                  # database policy/function tests
├── infra/                      # Docker Compose, deployment configuration
├── docs/
└── .github/workflows/
```

A reverse proxy should expose the PWA and API under the same public origin (for example, `/` and `/api`). Browser code must use relative paths, never `localhost` fallback URLs.

---

## 3. Technology decisions supported by research

### 3.1 Unified PWA: choose Next.js App Router + TypeScript + Tailwind

**Recommendation:** Start a current stable Next.js project with the App Router, TypeScript, Tailwind CSS, and a custom service-worker registration. The official Next.js PWA guide supports an `app/manifest.ts`/`app/manifest.json` manifest, service-worker registration, and web-push patterns. A valid manifest and HTTPS are necessary for home-screen installation. [1]

**Implementation rules**

- Build all role views in one app: `/driver`, `/dispatch`, and `/admin`.
- Use middleware/server layout checks for route gating and API authorization for actual enforcement.
- Cache only the application shell and non-sensitive static assets by default.
- Store unsent driver actions (collection, skip, road hazard, SOS acknowledgement) in an IndexedDB outbox with a client-generated idempotency key.
- Use Background Sync only as progressive enhancement; replay on `online`, focus, and app launch as the baseline fallback.
- Do not cache authenticated API responses broadly in a service worker.

### 3.2 Authentication and RBAC: choose Supabase Auth only

**Recommendation:** Retire Firebase session logic for the new application and use Supabase Auth as the sole identity system, matching PRD v2.0. Store application roles in a protected role table/custom JWT claim, enforce them in Express, and enforce data boundaries again with Supabase Row Level Security (RLS).

Supabase documents a custom access-token hook for adding a role claim to the JWT and then using that claim in RLS policies. [2] Its CLI workflow keeps schema, migrations, and seed data under version control and supports repeatable local resets. [3]

**Role rules**

| Role | Must be allowed | Must be denied |
| --- | --- | --- |
| Driver | Own active shift, assigned route, own location/collection/exception actions | Other drivers’ data, payroll, vehicle registry changes, route publication |
| Dispatcher | Operational bins/alerts, route generation and publication, live fleet monitoring | Wage administration, user role escalation |
| Admin / HR | User/vehicle registry, wages, payroll approval/export, organization configuration | Nothing by default, but all privileged actions must be audited |
| Device | Publish only telemetry for its registered bin/device identity | Any human-facing or administration operation |

**Migration practice**

1. Initialize `supabase/` and pull any existing remote schema only after taking a backup.
2. Make the v2.0 schema the version-controlled baseline.
3. Add RLS to every exposed table and test each policy with real role tokens.
4. Generate TypeScript database types after every migration.
5. Never use a service-role key in browser code.

### 3.3 IoT ingestion: stage HTTPS, then add MQTT over TLS/mTLS

**Recommendation:** Make an authenticated HTTPS telemetry endpoint the Phase 2 pilot path because it is simpler to observe and test with ESP32 devices. Add MQTT for reliable long-lived device communication only after the device contract and operational workflow are stable.

For the pilot MQTT path, use an established broker/managed service with TLS, per-device identities, and topic-level access controls. AWS IoT documentation, for example, supports both HTTPS and secure MQTT and identifies devices through X.509 client certificates. [4] Regardless of broker, the security design must require encrypted transport, unique device credentials, no anonymous device access, topic ACLs, replay protection, and credential rotation.

**Telemetry contract**

```json
{
  "message_id": "uuid-or-device-sequence",
  "bin_id": "uuid",
  "observed_at": "2026-09-02T10:15:00Z",
  "fill_percent": 92,
  "weight_kg": 184.5,
  "temp_celsius": 31.2,
  "smoke_detected": false,
  "firmware_version": "1.0.0"
}
```

**Endpoint and topic design**

```text
POST /api/v1/device/telemetry
MQTT topic: organizations/{orgId}/devices/{deviceId}/telemetry
```

- Bind `deviceId` to a bin server-side; do not trust a caller-provided bin ID alone.
- Treat the MAC address as an identifier, **not** as a secret or sufficient authentication factor.
- Reject malformed, stale beyond the approved clock tolerance, unsigned, oversized, duplicate, or rate-excessive telemetry.
- Write immutable telemetry history and update a materialized/latest-state record in one transaction.
- Create/close alert state through a deterministic alert evaluator, not in browser code.

### 3.4 Routing: use a provider adapter and decide after a real-route spike

The PRD requires four things simultaneously: real road travel time, heavy-vehicle restrictions, traffic-aware planning, and dispatcher-defined avoid areas. Do not choose a map provider based only on a generic driving distance matrix.

| Candidate | What research confirms | Decision |
| --- | --- | --- |
| **Mappls** | Its documentation advertises India-focused traffic/ETA matrix services and a heavy-vehicle routing API. However, its detailed matrix documentation says the `trucking` profile is limited to the static `distance_matrix` resource, whereas traffic resources have separate constraints. [5][6] | **Primary evaluation candidate** because the project already uses Mappls and Indian coverage is relevant. Confirm whether the exact paid API/product supports a truck + traffic matrix for the pilot before committing. |
| **HERE Matrix Routing** | The documented matrix service supports truck mode, truck dimensions/weight/tunnel restrictions, traffic, and avoided areas; custom traffic options work within its regional matrix mode. [7] | **Best functional fallback candidate** if the Mappls capability spike cannot satisfy truck-plus-traffic requirements. Validate coverage, pricing, and route quality in the pilot municipality. |
| **openrouteservice (ORS)** | The `driving-hgv` profile supports vehicle restrictions and GeoJSON `avoid_polygons`. [8] | Useful self-hosted/benchmark option, but do not assume it meets the PRD’s live-traffic requirement without a separate traffic solution. |

#### Required routing-provider spike

Before building routing UI, run the same 20–30 known collection legs against the shortlisted providers and score:

1. truck-restriction correctness;
2. traffic ETA usefulness at shift-planning time;
3. avoid-polygon adherence;
4. matrix limits, latency, rate limits, and cost;
5. route geometry quality for the actual pilot area; and
6. API terms/licensing and data residency needs.

Select one provider behind this interface so replacement is contained:

```ts
interface RoutingProvider {
  getMatrix(input: MatrixRequest): Promise<TravelMatrix>
  getRouteGeometry(input: RouteGeometryRequest): Promise<RouteGeometry>
}
```

**Hard rule:** If a real road matrix cannot be retrieved, return `planning_unavailable` for a publishable route. Do not silently substitute Haversine/Euclidean distance.

### 3.5 CVRP solver: keep OR-Tools, replace the current contract

OR-Tools is well-suited to the specified problem. It supports separate capacity dimensions for different cargo types—exactly what Waste-Wise needs for independent **weight** and **volume** constraints—and supports per-vehicle capacity arrays, time limits, and dropped visits with penalties. [9][10]

**Implementation design**

- Run the solver in a Python FastAPI process, not by spawning a Python child process per web request.
- Give each vehicle independent `weight_capacity_kg` and `volume_capacity_l` values.
- Add two capacity dimensions: `WeightKg` and `VolumeL`.
- Add a time dimension based on traffic-aware travel duration plus service time.
- Use large, severity-based penalties for unassigned bins rather than force-fitting an infeasible bin.
- Represent a depot/dump site as each vehicle’s end node; Phase 1 uses one collection trip per route. Add multi-trip dump returns only after the simple route model is validated.
- Set an explicit solver time limit and return a structured result: proposals, unassigned stops/reasons, all assumptions, matrix source/version/time, and solver statistics.
- Persist optimization input/output snapshots before a dispatcher publishes a route.

### 3.6 Location proof and privacy: treat the 50 m rule as an evidence policy

Browser geolocation only works in secure contexts, and its `accuracy` value is a 95% confidence radius measured in meters. [11] A raw coordinate within 50 m is therefore not sufficient evidence when the reported accuracy is poor.

**Recommended collection rule**

1. An active shift and active assigned route are required.
2. The PWA requests a fresh high-accuracy location over HTTPS.
3. Accept collection automatically only when:
   - distance to bin is at most 50 m;
   - reported location accuracy is at most the approved threshold (start with 25 m); and
   - the location timestamp is fresh (for example, within 30 seconds).
4. Otherwise show “GPS proof unavailable” and allow a dispatcher-approved override with reason and audit trail.
5. Do not begin continuous location tracking before `Start Shift`; stop it immediately on clock-out.
6. SOS must always be available during an active shift, even if GPS accuracy is insufficient; attach the latest known location and accuracy state.

### 3.7 Push notifications and offline field actions

The official Next.js PWA guidance includes service-worker and web-push patterns. [1] Firebase Cloud Messaging also requires a messaging service worker for background web messages and supports background display notifications. [12]

**Recommended sequence**

- P0: in-app Socket.IO alerts while the app is open; critical alert tone/visual state; durable alert inbox.
- P0 pilot: standards-based Web Push or FCM after a device/browser compatibility check; record subscription/token health and acknowledgement outcomes.
- P1: SMS/voice escalation through an approved provider for unacknowledged critical incidents.
- Driver mutation reliability: IndexedDB outbox first, then attempt the API; use Background Sync if available and an `online`/focus/launch replay fallback. This is important because browser Background Sync is not universal. [13]

### 3.8 Privacy and Indian rollout considerations

This is not legal advice. For an Indian deployment, driver location, account, wage, and shift records are personal data and require a privacy review. The Indian government states that the DPDP Rules, 2025 were notified in November 2025 and include phased compliance, clear notice/consent, purpose limitation, minimization, security safeguards, and data-principal rights. [14]

Build the following from the beginning:

- clear in-app explanation of why/when driver location is collected;
- active-shift-only tracking and a documented retention schedule;
- encrypted transport, least-privilege access, audit logging, and export access controls;
- a data-access/correction/deletion request process reviewed by counsel; and
- data-processing/vendor review before onboarding a municipality.

---

## 4. Data model changes required for v2.0

The PRD’s listed tables are the baseline. The application also needs the following explicit data-model decisions before coding UI flows.

### 4.1 Multi-tenant boundary

Because the target audience includes multiple municipalities/private agencies, introduce an `organizations` table and add `organization_id` to every operational table. Enforce organization isolation with RLS. Do not rely on client-provided filters for tenant separation.

### 4.2 Core tables to create in the first migration set

| Table | Purpose | Essential additions beyond PRD shorthand |
| --- | --- | --- |
| `organizations` | Municipal/customer boundary | name, status, timezone, alert configuration |
| `profiles` / `user_roles` | Human identity and role mapping | `auth.users` reference, organization ID, role, active status |
| `vehicles` | Needed for `routes.vehicle_id` and CVRP | weight/volume capacity, dimensions, truck profile, depot, status |
| `depots` / `dump_sites` | Start/end constraints | location, operating hours, capacity/availability |
| `bins` | Bin registry | organization/device reference, coordinates, volume capacity, lift limit, status, zone |
| `devices` | Device lifecycle/security | serial/MAC identifier, credential/certificate fingerprint, status, last seen, firmware version |
| `telemetry_logs` | Immutable raw telemetry | message ID, observed/received time, raw temperature/smoke, validation outcome |
| `bin_current_state` | Fast operational read model | latest telemetry, priority, freshness, active alert state |
| `alerts` / `alert_events` | Deduplicated safety workflow | severity, state, owner, acknowledgement/resolution history |
| `avoid_areas` | Dispatcher map restrictions | GeoJSON geometry, active period, reason, creator/version |
| `shifts` | Driver timekeeping | clock in/out, status, location consent/last position metadata |
| `routes` / `route_stops` | Planned and actual work | version, constraint/matrix snapshot, vehicle, stop sequence/status/reason |
| `collection_events` | Immutable field evidence | idempotency key, proof location/accuracy, outcome, note/evidence, actor |
| `driver_location_events` | Active-shift operational tracking | timestamp, point, accuracy, source; retention policy |
| `notification_subscriptions` | Push/Web Push delivery | user/device, subscription/token, platform, health |
| `audit_events` | Privileged-action trace | actor, entity, action, before/after summary, correlation ID |

### 4.3 Database conventions

- Use `uuid` keys, `timestamptz` timestamps, numeric/decimal units for weights/money, and explicit unit names in columns.
- Use append-only telemetry, alert-event, collection-event, and audit-event records; create controlled current-state views/materializations for fast reads.
- Store geometry in a consistent WGS84 representation; validate longitude/latitude and polygon closure.
- Make all mobile/device write endpoints idempotent using a unique request/message ID.
- Add foreign keys, check constraints, indexes for organization/status/time and geography, and soft archive states where history matters.

---

## 5. Build plan: critical path from 10% to a pilot

### Phase 0 — Decisions and safe baseline (must happen first)

| Work package | Deliverables | Definition of done |
| --- | --- | --- |
| Product/pilot discovery | Named pilot organization, bin/device count, vehicle capacities, depots, shifts, alert owner, and payroll export format | Written pilot configuration and signed-off acceptance scenarios |
| Route-provider spike | Mappls vs. HERE/ORS benchmark on actual representative legs | A provider decision, fallback policy, unit cost/limit record, and documented quality results |
| Hardware protocol spike | ESP32 test device sends signed HTTPS telemetry; optionally proves MQTT TLS path | Device identity, retry, clock, error, and provisioning flows demonstrated |
| Security/data review | Threat model and data-flow review | No browser secrets, no default admin credentials, role/device trust boundaries approved |
| Repository baseline | CI skeleton, formatting, lint/type/test commands, environment template | Clean clone can start development without real credentials |

### Phase 1 — Unified skeleton (10% → 25%)

1. Scaffold `apps/web` with Next.js, TypeScript, Tailwind, responsive app shell, and PWA manifest.
2. Add Supabase Auth and role-aware routing for Driver, Dispatcher, and Admin/HR.
3. Initialize Supabase migrations, enums, organization boundary, RLS policies, seed data, and type generation.
4. Establish Express API structure, OpenAPI/Zod request validation, JWT middleware, correlation IDs, and audited error handling.
5. Add a single Docker/local-development command path and a documented `.env.example` with no secrets.

**Exit test:** An admin, dispatcher, and driver can sign in to the same PWA and only reach their permitted empty-state screens; an unauthorized API request fails server-side.

### Phase 2 — Bin registry, device telemetry, and live safety operations (25% → 45%)

1. Build Admin bin/device/vehicle registry forms and durable CRUD APIs.
2. Implement signed HTTPS device ingestion, raw telemetry history, current-state projection, and device last-seen state.
3. Implement the exact PRD alert engine: CRITICAL smoke/fire or temperature >65°C; HIGH weight/lift capacity or fill >90%; WARNING no check-in >12 hours.
4. Add alert deduplication, acknowledgement, ownership, resolution, Socket.IO events, and dispatcher alert inbox.
5. Build dispatcher live map/list filters with freshness/offline state.

**Exit test:** A hardware simulator sends one valid critical event. It appears once in durable alert history, updates the map, raises an in-app dispatcher alert, and follows acknowledgement/resolution audit flow.

### Phase 3 — Routing brain and dispatch (45% → 65%)

1. Implement routing-provider adapter and cache/version the selected road matrix.
2. Refactor Python service to FastAPI + OR-Tools with weight, volume, time, depot/dump-site, driver/vehicle, priority, and dropped-stop rules.
3. Build dispatcher flow: select shift, depot, eligible bins, vehicles/drivers, avoid areas → generate proposals → inspect infeasible/unassigned bins → edit → publish versioned routes.
4. Render provider route geometry and route summaries; broadcast published route updates to assigned driver.
5. Add avoid-area drawing, validation, versioning, and recalculation.

**Exit test:** A dispatcher can generate/publish a truck-feasible route from real matrix data. The stored result identifies matrix provider/time, load by both dimensions, route geometry, and any unassigned bins.

### Phase 4 — Driver execution, hazards, and SOS (65% → 80%)

1. Build mobile-first driver shift start/end and active-route experience.
2. Enable active-shift-only location tracking with visibility/accuracy state.
3. Implement collection outcome controls, 50 m + accuracy proof, dispatcher override, and immutable collection events.
4. Implement skipped/inaccessible/damaged outcomes with reason and dispatcher exception workflow.
5. Implement road-hazard reports, avoid-area suggestion/review, and SOS escalation/acknowledgement.
6. Add IndexedDB outbox, retry, idempotency, and offline/degraded-state UI.

**Exit test:** A driver can complete a shift on a mobile device through intermittent network conditions without duplicate collection records; the dispatcher sees progress and exceptions in real time.

### Phase 5 — Payroll, reporting, and pilot hardening (80% → 100%)

1. Build Admin/HR shift review, hours calculation, wage calculation, approval, adjustment audit, and municipality-specific CSV export.
2. Add dashboard metrics from durable data only: alerts, overflow risk, collections, completion, route deviations, worked hours, and payroll status.
3. Add Web Push/FCM pilot notification implementation after browser/device validation.
4. Complete accessibility, security, load, failure-recovery, and field usability testing.
5. Create deployment, backup/restore, incident, support, and rollback runbooks; execute a controlled pilot/UAT.

**Exit test:** An entire test shift—from telemetry to alert to route to verified collection to approved payroll export—can be demonstrated from durable records, including a recovery scenario.

---

## 6. Parallel workstreams that reduce delivery time

| Stream | Can run in parallel after | Output |
| --- | --- | --- |
| UI system and role layouts | Next.js scaffold + route contract | Responsive Driver/Dispatcher/Admin shells and shared components |
| Database/RBAC | Pilot discovery | Migrations, RLS, seed data, generated types, role tests |
| Hardware simulator | Telemetry JSON contract | Reproducible ESP32/HTTP/MQTT test messages and fault scenarios |
| Routing spike/solver | Vehicle/bin/depot data contract | Provider scorecard, typed matrix adapter, solver test fixtures |
| Operations/HR discovery | Pilot discovery | Shift policy, wage/export mapping, route exception rules, alert escalation runbook |
| QA/CI | Repository baseline | Unit, contract, integration, E2E, and security checks from the first feature |

The **database/RBAC contract**, **telemetry contract**, and **routing-provider spike** are blocking dependencies. Visual dashboards can be built in parallel but must not invent a separate data contract.

---

## 7. Testing and operational quality plan

### Automated quality gates

| Layer | Required checks |
| --- | --- |
| Frontend | TypeScript, ESLint, component tests, accessibility checks, responsive role-route tests |
| API | Unit tests, OpenAPI/Zod validation tests, role/object authorization tests, idempotency and rate-limit tests |
| Database | Migration reset test, RLS policy tests for each role/organization, function/trigger tests |
| Optimizer | Deterministic fixtures for capacity, dropped high-priority bins, depot return, timeout, and matrix errors |
| End-to-end | Playwright paths for admin registry, telemetry alert, dispatcher route publication, driver collection, SOS, payroll CSV |
| Devices | Telemetry contract tests, replay/duplicate tests, invalid signature tests, offline/retry simulation |
| Operations | Health/readiness probes, structured logs, error monitoring, backup/restore rehearsal, dependency outage tests |

### Minimum safety tests

- A driver cannot retrieve or mutate another driver’s route or shift.
- A caller cannot assign itself an admin role or use a MAC address alone to impersonate a device.
- Duplicate telemetry and collection retries produce one durable event/result.
- Critical smoke/temperature alerts are deduplicated but cannot be silently dismissed.
- A published route never exceeds weight or volume capacity.
- A real-matrix failure prevents route publication and leaves the previous route intact.
- GPS collection fails closed when distance/accuracy evidence is inadequate; an auditable dispatcher override remains possible.
- Clocking out stops active tracking and prevents further driver collection actions until a new shift begins.

---

## 8. Risks and how to control them

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| Map provider cannot offer truck + traffic matrix in the needed geography | Violates the core routing differentiator | Complete provider spike before UI/solver investment; keep adapter boundary and selected fallback. |
| Device telemetry is unauthenticated or replayable | Can create false safety incidents or hide real ones | Per-device credentials/certificates, TLS, message ID, timestamp window, rate limits, revocation. |
| Location proof is inaccurate | Can create unfair driver accountability or false completion | Enforce accuracy threshold, location age, override/audit path, and field calibration. |
| Dual Firebase/Supabase identity states | Role/account inconsistencies and security gaps | Consolidate to Supabase Auth before building role flows. |
| Big-bang rewrite loses useful work | Wasted effort and scope churn | Migrate by API contracts and feature slices; retain legacy code as temporary reference only. |
| Payroll rules vary by municipality | Incorrect wage export or compliance issue | Obtain sample payroll template and approval workflow in Phase 0; make export mapper configurable. |
| Offline PWA behavior differs by browser | Lost field events | IndexedDB outbox + visible queued state + idempotent API; do not rely solely on Background Sync. |
| Privacy/compliance is deferred | Driver tracking becomes a late blocker | Build active-shift consent/retention/audit behavior in Phase 1, then obtain legal review. |

---

## 9. Immediate implementation backlog

This is the recommended first set of tickets, in order:

1. **ADR-001:** Approve the target architecture and one identity provider (Supabase Auth).
2. **SPIKE-001:** Benchmark Mappls, HERE, and ORS against the actual pilot-route requirements; record decision.
3. **CHORE-001:** Initialize a Next.js/TypeScript/Tailwind PWA workspace without deleting the legacy prototype until replacement routes are live.
4. **DB-001:** Add versioned Supabase migration baseline: organizations, roles, users/profiles, vehicles, depots, bins, devices, RLS, seed data.
5. **API-001:** Create an Express TypeScript API with JWT/RBAC middleware, OpenAPI contract, structured errors, `/health`, and `/ready`.
6. **WEB-001:** Build role-aware sign-in redirect and three protected, responsive empty-state shells.
7. **IOT-001:** Define and test the signed HTTP telemetry contract and a hardware simulator.
8. **IOT-002:** Persist telemetry/current state; implement exact critical/high/warning alert state machine.
9. **OPS-001:** Build dispatcher map/list and alert acknowledgement workflow.
10. **ROUTE-001:** Introduce the routing-provider adapter and Python FastAPI optimizer contract.

Do not begin payroll dashboards, visual polish, or advanced analytics until tickets 1–8 have a tested, durable operational foundation.

---

## 10. Decisions needed from the product owner

1. What is the first pilot organization, fleet size, number of bins/devices, depot/dump sites, and shift schedule?
2. What specific truck capacities/dimensions, lift limits, and vehicle restrictions must be modeled?
3. Is real-time traffic mandatory for the first pilot route proposal, and what is the approved map-provider budget?
4. What is the approved ESP32/device identity and provisioning approach: signed HTTPS first, MQTT/mTLS, or managed IoT service?
5. What payroll CSV columns and approval rules must the municipality accept?
6. What evidence is sufficient for collection when GPS is unreliable: dispatcher override, QR/NFC, photo, or all of them?
7. What is the retention policy for driver location, raw telemetry, alerts, and payroll records?
8. Which browsers/devices will drivers actually use during the pilot?

---

## 11. Research sources

1. [Next.js — Progressive Web Apps guide](https://nextjs.org/docs/app/guides/progressive-web-apps)
2. [Supabase — Custom claims and RBAC](https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac)
3. [Supabase — Local development, schemas, and migrations](https://supabase.com/docs/guides/local-development/cli-workflows)
4. [AWS IoT Core — Device communication protocols](https://docs.aws.amazon.com/iot/latest/developerguide/protocols.html)
5. [Mappls — Driving Distance-Time Matrix API](https://developer.mappls.com/documentation/sdk/rest-apis/mappls-distance-matrix-api/readme/)
6. [Mappls — Heavy Vehicle Routing API](https://developer.mappls.com/mapping/routing-for-heavy-vehicles/)
7. [HERE — Matrix Routing API developer guide](https://developer.here.com/documentation/matrix-routing-api/dev_guide/index.html)
8. [openrouteservice — Routing options](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/routing-options)
9. [Google OR-Tools — Capacity constraints](https://developers.google.com/optimization/routing/cvrp)
10. [Google OR-Tools — Penalties and dropping visits](https://developers.google.com/optimization/routing/penalties)
11. [MDN — Geolocation coordinate accuracy](https://developer.mozilla.org/en-US/docs/Web/API/GeolocationCoordinates/accuracy)
12. [Firebase Cloud Messaging — Receive messages in web apps](https://firebase.google.com/docs/cloud-messaging/web/receive-messages)
13. [Microsoft Edge — PWA Background Sync](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/how-to/background-syncs)
14. [Press Information Bureau, Government of India — DPDP Rules, 2025](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2190655&reg=48&lang=2)
