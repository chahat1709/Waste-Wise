# Waste-Wise Product Requirements Document (v2.0)

| Field | Value |
| --- | --- |
| **Product** | Waste-Wise — Integrated Smart Waste & Municipal Operations Platform |
| **Target audience** | Municipalities and private waste-collection agencies |
| **Application model** | A single, unified responsive Web/PWA application for desktop and mobile |
| **Current delivery baseline** | 10% complete |
| **Priority** | P0 critical path: make the operational workflow safe, feasible, and auditable |

> This version supersedes the prior repository draft. It defines Waste-Wise as one role-aware operational application—not separate driver and administrator products.

---

## 1. Product Vision & Scope

Waste-Wise is an end-to-end municipal waste-management platform. It transforms waste collection from a static, scheduled chore into a dynamic, hazard-aware, and highly optimized logistical operation. By combining edge-computed IoT telemetry (fill, weight, hazards) with real-world Capacitated Vehicle Routing Problem (CVRP) logic and automated workforce tracking, the platform minimizes operational costs while maximizing safety and driver accountability.

### Core differentiators

1. **Hazard & weight awareness** — Bins report not just volume, but physical weight and fire/smoke risks, preventing equipment damage and truck fires.
2. **Reality-based routing** — Routes are calculated using real-world road networks, traffic conditions, and heavy-vehicle constraints, not straight lines.
3. **Unified ecosystem** — There is no separate driver app and admin portal. One application changes dynamically according to the authenticated user’s role.
4. **Workforce & payroll engine** — Completed field routes and logged shift hours become verifiable payroll data automatically.

### Scope boundaries

The first release focuses on a reliable operational workflow:

1. Register bins, devices, drivers, dispatchers, administrators, and trucks.
2. Ingest and preserve bin telemetry securely.
3. Detect hazards and notify the correct operational users immediately.
4. Generate heavy-vehicle-aware, capacity-constrained routes from real road-network cost data.
5. Dispatch routes and track collection execution within a shift.
6. Turn verified shift and collection data into payroll-ready reporting and CSV export.

---

## 2. User Roles & the Single-App Experience

The system operates as **one unified application**. Access control dictates what the user sees upon login, while the same backend, data model, and real-time event stream support all roles.

| Role | Unified app view | Primary actions |
| --- | --- | --- |
| **Driver** | Mobile-optimized execution view | Clock in/out, view the active route, tap to complete/skip stops, report road hazards, and trigger SOS. |
| **Dispatcher** | Desktop-optimized map and routing view | Monitor real-time bin alerts, generate CVRP routes, assign drivers, and monitor live truck locations. |
| **HR / Admin** | Desktop-optimized analytics view | Manage user accounts, view shift logs, export payroll data, and manage the vehicle registry. |

> **Role-model alignment:** “HR / Admin” is delivered through the v2.0 `admin` role defined in the required database schema. A separate `hr` enum role is not currently part of the specified schema.

### Role-based access requirements

- The application must route each authenticated user to the appropriate role experience.
- Authorization must be enforced by the backend/API, not only by hiding UI controls.
- Drivers may access only their own active shift, assigned route, and relevant bin details.
- Wage data and payroll approval are visible only to admins.
- Dispatcher and admin actions that change a route, alert, payroll state, or device configuration must be auditable.

---

## 3. Detailed System Requirements (P0 — Critical Path)

### Module A: IoT Hardware & Telemetry Engine

The physical bins must transmit a comprehensive data payload. The backend must ingest, validate, and store this rapidly.

#### Supported sensor array

| Measurement | Supported hardware |
| --- | --- |
| **Volume** | Ultrasonic HC-SR04 or Time-of-Flight (ToF) sensor |
| **Weight** | Base-mounted load cells with HX711 amplifier |
| **Hazard** | MQ-2 gas/smoke sensor and internal temperature/flame sensor |

#### Data ingestion API

- The backend must accept JSON payloads via secure HTTP `POST` or MQTT.
- Every telemetry message must contain: `bin_id`, `timestamp`, `fill_percent`, `weight_kg`, `temp_celsius`, and `smoke_detected` (boolean).
- The API must authenticate the device/bin identity before accepting a message.
- The API must validate payload type, value range, timestamp, and duplicate/retry behavior before persisting state.
- The latest accepted state and the telemetry history must be stored durably.
- Telemetry ingestion must emit real-time events to the unified application after a successful accepted update.

Example payload:

```json
{
  "bin_id": "bin-uuid-or-registered-id",
  "timestamp": "2026-09-02T10:15:00Z",
  "fill_percent": 92,
  "weight_kg": 184.5,
  "temp_celsius": 31.2,
  "smoke_detected": false
}
```

#### Alert state machine

| Severity | Trigger | Required response |
| --- | --- | --- |
| **CRITICAL** | Smoke/fire detected **or** temperature exceeds **65°C** | Instantly alert the dispatcher with audio/visual flags and send a push notification to the nearest active driver. |
| **HIGH** | Weight exceeds truck lift capacity **or** fill level exceeds **90%** | Create a high-priority operational alert and prioritize the bin for dispatch. |
| **WARNING** | Device has not checked in for more than **12 hours** | Flag the bin/device as offline for dispatcher/admin follow-up. |

#### Telemetry and alert acceptance rules

- A single threshold crossing must create one actionable active alert; repeated telemetry must not create an alert storm.
- A CRITICAL event must remain visible until resolved through an auditable action.
- The system must record alert source, severity, bin, timestamps, status, and notification outcome.
- A failed database write must never be reported as a durable telemetry or alert success.
- The UI must show data freshness so operators can distinguish live, stale, and offline bin state.

---

### Module B: CVRP Routing & Mapping Engine

The solver must respect the laws of physics and real-world infrastructure.

#### Cost-matrix integration

- The backend **must not use Euclidean or straight-line distance** for production route planning.
- It must query a distance-matrix API—such as OSRM, Google Maps Routes, or Mapbox—to retrieve real driving times between all selected/full bins.
- The source and freshness of the cost matrix must be retained with the route result.
- If a provider is unavailable, the system must show an explicit degraded/failure state rather than silently publishing a route based on straight-line distance.

#### Vehicle constraints — the “C” in CVRP

The optimizer must factor in the specific truck’s:

- maximum **weight** capacity (for example, 5,000 kg), and
- maximum **volume** capacity.

Route generation must stop adding bins when either limit is reached, requiring the truck to return to the dump site/depot before additional bins can be serviced. Published routes must never exceed either configured capacity.

#### Road constraints

- Distance-matrix/routing API calls must specify a **heavy-vehicle profile** where the provider supports one, avoiding narrow residential alleys and weight-restricted bridges.
- Dispatchers must be able to draw and manage **avoid polygons** on the map—for example, around flooded areas or festival closures—and instantly recalculate routes around them.
- Routes must include the relevant depot/dump-site return legs.
- A dispatcher must be able to review, edit, and approve a generated route before publication.

#### Route output requirements

For every route proposal/published route, store and display:

- assigned driver and vehicle;
- ordered bin stops;
- total distance and estimated time;
- estimated weight and volume load;
- depot/dump-site start and return context;
- routing-provider/matrix source and solver version;
- planning constraints, avoid polygons, and bins that could not be assigned; and
- route status and audit history.

---

### Module C: Driver Execution & Workforce Management

This module tracks the human element for municipal payroll and accountability.

#### Shift tracking

- Drivers must click **Start Shift** in the PWA before accessing their routes.
- Starting a shift records `clock_in_time`.
- Location tracking begins only while the shift is active, preserving driver privacy off the clock.
- Drivers must be able to end a shift, recording `clock_out_time`.
- The system must retain a clear status for in-progress, completed, and payroll-approved shifts.

#### Proof of collection

- To clear a bin from a route, a driver must be within a **50-meter GPS radius** of the bin.
- The driver must select one of the supported outcomes:
  - **Collected**
  - **Inaccessible** (for example, a car is parked in front of the bin)
  - **Damaged**
- Every completion/exception must record the driver, route, bin, timestamp, location-validation result, and outcome.
- Inaccessible and damaged outcomes must be visible to dispatchers as actionable exceptions.
- A skipped stop must be recorded as a failed route stop with a reason; it must not disappear from route history.

#### Road hazards and SOS

- Drivers must be able to report a road hazard from the mobile execution view, including the active-route context, current location, timestamp, and an optional note/evidence.
- A reported road hazard must appear immediately in the dispatcher’s map/routing view and be usable when creating or updating an avoid polygon.
- Drivers must be able to trigger an SOS during an active shift.
- An SOS must create a high-visibility real-time dispatcher alert containing the driver, active route/shift, latest available location, timestamp, and acknowledgement/resolution audit trail.

#### Payroll calculation

The HR dashboard must:

- calculate worked time as `clock_out_time − clock_in_time`;
- display **Total Hours Worked**, **Total Bins Collected**, and **Total Route Deviations**;
- calculate wages from the driver’s configured hourly wage and approved shift duration; and
- provide a one-click CSV export mapped to the municipality’s salary payout structure.

Payroll records must not be silently changed after approval; corrections require an auditable adjustment or reapproval flow.

---

## 4. Exact Database Schema Architecture

The relational database (for example, PostgreSQL/Supabase) requires the following strict table structures.

### 4.1 `users` — the core of the unified app

| Column | Type / constraint | Notes |
| --- | --- | --- |
| `id` | UUID, primary key | Core user identifier |
| `full_name` | String | User’s full name |
| `role` | Enum: `admin`, `dispatcher`, `driver` | Determines application experience and permissions |
| `hourly_wage` | Decimal | Visible only to admins |
| `status` | Enum: `active`, `suspended` | Controls account availability |

### 4.2 `bins`

| Column | Type / constraint | Notes |
| --- | --- | --- |
| `id` | UUID, primary key | Bin identifier |
| `mac_address` | String, unique | IoT authentication association |
| `latitude` / `longitude` | Float | Physical bin location |
| `max_weight_capacity_kg` | Integer | Lift/weight constraint for the bin |
| `status` | Enum: `healthy`, `maintenance`, `offline` | Operational device/bin state |

### 4.3 `telemetry_logs`

| Column | Type / constraint | Notes |
| --- | --- | --- |
| `id` | UUID | Telemetry record identifier |
| `bin_id` | Foreign key | Associated bin |
| `timestamp` | DateTime | Device-observed event time |
| `fill_percentage` | Integer, 0–100 | Current fill percentage |
| `current_weight_kg` | Float | Current measured weight |
| `hazard_status` | Enum: `safe`, `smoke`, `fire` | Classified hazard state |

### 4.4 `shifts_and_payroll`

| Column | Type / constraint | Notes |
| --- | --- | --- |
| `id` | UUID | Shift/payroll record identifier |
| `driver_id` | Foreign key | Driver/user reference |
| `clock_in` | DateTime | Shift start time |
| `clock_out` | DateTime, nullable | Shift end time |
| `total_bins_collected` | Integer | Verified collection total |
| `status` | Enum: `in_progress`, `completed`, `approved_for_payroll` | Payroll workflow state |

### 4.5 `routes` and `route_stops`

**`routes`** must contain:

- `id`
- `driver_id`
- `vehicle_id`
- `status` — `draft`, `published`, `active`, or `completed`

**`route_stops`** must contain:

- `route_id`
- `bin_id`
- `sequence_order` (Integer)
- `status` — `pending`, `collected`, or `failed`

### 4.6 Required schema alignment before implementation

The tables above are the required v2.0 baseline. To preserve the mandatory incoming telemetry payload and enforce vehicle constraints, the implementation schema must additionally retain the following data rather than discard it after evaluation:

- `temp_celsius` and `smoke_detected` (or equivalent raw telemetry fields) in `telemetry_logs`, because CRITICAL state depends on them;
- a device receipt/idempotency field and received timestamp for safe message retry handling;
- a `vehicles` entity containing at least vehicle ID, weight capacity, volume capacity, heavy-vehicle routing profile, and availability, because `routes.vehicle_id` and the CVRP constraints depend on it;
- route planning metadata for depot/dump-site, selected constraints, cost-matrix provider, and avoid polygons; and
- actual stop/collection event data needed to calculate exceptions and route deviations accurately.

These supporting fields clarify and implement the specified P0 behavior; they do not replace the strict tables above.

---

## 5. Technical Stack Blueprint

| Layer | Recommended technology | Purpose |
| --- | --- | --- |
| **Frontend (unified app)** | React.js or Next.js, built as a Progressive Web App | One installable, responsive experience for desktop operations and mobile drivers without an app-store dependency |
| **Styling** | Tailwind CSS | Rapid responsive UI adaptation across admin, dispatcher, and driver views |
| **Backend & API** | Node.js with Express | Application API, authorization, device ingestion, and operational workflow services |
| **Real-time layer** | Socket.IO | Instant fire/hazard alerts for dispatchers and live route updates for drivers |
| **Routing engine** | Python microservice using OR-Tools | CVRP optimization logic |
| **Cost matrix / mapping** | Local OSRM server or Mapbox API | Real-road travel matrix and map/routing support |
| **Database and authentication** | Supabase (PostgreSQL) | Relational operational data and built-in user authentication |

### Architecture requirements

- The frontend must call backend services through same-origin/relative API paths in production and preview environments; browser code must not target `localhost` for backend access.
- The routing engine must have bounded execution time and return a structured failure result without changing an existing published route.
- The database is the authoritative operational record. In-memory state may be a cache but must not be the only durable store for routes, alerts, shifts, collections, or payroll data.
- Secrets, device credentials, map keys, service-account credentials, and administrative keys must be environment-managed and never exposed to the browser or ordinary API logs.

---

## 6. Implementation Phasing: 10% to 100% Roadmap

### Phase 1: The Unified Skeleton — current focus

1. Set up the Next.js application with Supabase Auth.
2. Build the RBAC router:
   - driver login → mobile shift view;
   - admin login → desktop dashboard;
   - dispatcher login → live operations/route-planning view.
3. Create the Bin Registry database tables and manual creation forms.

**Phase exit:** authenticated users reach the correct single-app experience, role permissions are enforced server-side, and admins can create/manage registered bins in durable storage.

### Phase 2: Hardware Talk

1. Write the Node.js API endpoint to receive `POST` requests from ESP32/microcontroller devices.
2. Implement the Alert State Machine; for example, if `smoke_detected == true`, trigger a Socket.IO event to the frontend.
3. Build the dispatcher’s live map view.

**Phase exit:** authenticated device telemetry updates a bin’s durable state/history, the alert state machine produces deduplicated priority alerts, and dispatchers can see live/stale/offline bins on a map.

### Phase 3: The Routing Brain

1. Connect the Python CVRP script to the distance-matrix API.
2. Build the dispatcher UI for **Generate Shift Routes**.
3. Save generated optimal routes to the `routes` database table.

**Phase exit:** dispatcher-approved routes use real road-network cost data, respect truck weight/volume and heavy-vehicle constraints, include depot/dump-site return logic, and are persisted for assigned drivers.

### Phase 4: Execution & HR

1. Complete the driver mobile view: **Start Route**, tap bins to complete them, and enforce GPS-radius checks.
2. Build the HR dashboard: a table summarizing completed shifts, calculated wages, and CSV export.

**Phase exit:** a driver can complete an entire shift with verifiable collection/exception records; admins can review and approve payroll-ready data and export it to the municipality’s salary payout structure.

---

## 7. Release Guardrails

Waste-Wise is ready for a controlled operational pilot only when:

- the unified PWA supports all three roles through server-enforced RBAC;
- every accepted device message is authenticated, validated, and stored durably;
- smoke/fire and temperature-over-65°C events create immediate, testable critical alerts;
- every published route is based on a real road-network cost matrix and respects configured truck weight and volume capacity;
- heavy-vehicle restrictions and dispatcher avoid polygons are represented in the routing workflow;
- driver location collection is active only during shifts, and collection clearances enforce the 50-meter rule;
- shift, route, collection, deviation, and payroll records have an auditable history; and
- the HR CSV export reconciles with approved completed shifts and configured wage data.

## 8. Source-of-Truth Principles

1. A UI screen or prototype endpoint does not count as completed functionality until its full role, persistence, validation, and error path is tested.
2. Road-aware heavy-vehicle routing is mandatory for published operational routes; straight-line/Haversine results are not a production substitute.
3. Safety alerts take priority over routine route optimization.
4. Driver privacy is protected by limiting location tracking to active shifts.
5. Payroll is calculated from verified operational records and must remain traceable after export or approval.
