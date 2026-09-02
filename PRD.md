# Waste-Wise Product Requirements Document

| Field | Value |
| --- | --- |
| Product | Waste-Wise — smart waste collection operations platform |
| Document status | Draft, derived from the current repository and product README |
| Product baseline | **10% complete** (user-reported on 2026-09-02) |
| Intended release | Pilot-ready operational MVP, followed by a production municipal rollout |
| Primary users | Operations administrators / dispatchers, collection drivers, supervisors |

> **Important:** The README describes the intended vision, not verified delivery status. This PRD treats the repository as an early prototype and defines the remaining product work needed to make that vision operational.

---

## 1. Product summary

Waste-Wise helps waste-collection teams decide **which bins need service, which vehicle should collect them, and what route each driver should follow**. It combines bin telemetry, actionable alerts, route optimization, dispatch, and proof of collection in one web-based workflow.

The product starts with a pilot fleet and a limited set of connected bins. It must remain useful when a bin, device, map provider, or database is temporarily unavailable, while clearly showing data freshness and degraded state to operators.

### Problem to solve

Manual waste collection schedules create three operational failures:

1. Bins overflow before the next scheduled collection because field conditions are invisible to dispatchers.
2. Trucks travel unnecessary distance collecting low-fill bins while urgent bins wait.
3. Dispatchers and supervisors lack a reliable audit trail for assignments, alerts, collections, and exceptions.

### Product promise

Give an operations team a trustworthy, real-time view of waste demand and turn it into feasible, trackable collection work with minimal manual coordination.

---

## 2. Goals and success measures

### Goals

1. **Prevent overflow and safety incidents.** Surface high-fill, overweight, temperature, and explicitly reported hazard conditions quickly.
2. **Improve collection efficiency.** Prioritize service demand and create vehicle-capacity-aware routes rather than relying on fixed rounds.
3. **Make field execution accountable.** Allow drivers to receive work, navigate it, record collection, and report exceptions.
4. **Provide operational control.** Enable admins to manage bins, devices, fleet capacity, users, and live dispatch decisions.
5. **Be pilot-safe and supportable.** Protect credentials and operational data, validate inputs, preserve an audit trail, and expose health/failure state.

### Measurable MVP outcomes

Baseline values must be captured during pilot setup. The following measures are release targets, not claims about the current prototype.

| Outcome | Target |
| --- | --- |
| Urgent-bin visibility | At least 95% of accepted telemetry updates appear in the operations view within 5 seconds under pilot load. |
| Alert timeliness | A threshold or hazard alert is created and visible to the assigned dispatcher/driver within 10 seconds of valid telemetry ingestion. |
| Route feasibility | 100% of published routes respect configured vehicle capacity, depot, and eligible-bin constraints. |
| Collection traceability | At least 98% of completed collections have a timestamp, driver, route, bin, and outcome recorded. |
| Service quality | Overflow incidents per active bin decline against the pre-pilot baseline after sufficient pilot data is collected. |
| Availability | The pilot service has a documented backup/recovery procedure and a monitored health signal for every critical dependency. |

### Non-goals for the first operational MVP

- Building custom IoT hardware or firmware beyond documenting the supported device contract.
- Full ERP, payroll, invoicing, procurement, or resident billing.
- Autonomous vehicle dispatch or routing without a dispatcher review path.
- Citywide public reporting, native mobile apps, or advanced ML demand forecasting before the pilot workflow is reliable.
- Treating straight-line distance as a validated substitute for road routing in production reporting.

---

## 3. Users and jobs to be done

| User | Primary job | What success looks like |
| --- | --- | --- |
| Administrator / dispatcher | Monitor service demand, respond to alerts, generate and assign routes | Can identify urgent bins, publish feasible work, and resolve exceptions without switching systems. |
| Driver | See assigned stops, perform collections, and report status | Knows the next stop and can confirm or flag each collection quickly, even during intermittent connectivity. |
| Supervisor | Review fleet performance, safety incidents, and completion | Can see what happened, who acted, and where operations need intervention. |
| Device / integration operator | Register and maintain bin devices | Can safely provision a device, verify its last check-in, and diagnose bad telemetry. |

### Permissions

- **Admin:** manage users, bins, devices, thresholds, fleet data, routes, and reporting.
- **Dispatcher:** view all operational data; generate, edit, publish, reassign, and cancel routes; acknowledge alerts.
- **Driver:** view only assigned/current routes and permitted bin details; submit location, collection, and exception events.
- **Supervisor:** read operational data and reports; optionally approve route changes depending on local process.
- **Device:** may submit telemetry only for its registered identity; it must never have administrative access.

Role checks must be enforced on the server, not only hidden in the browser UI.

---

## 4. Product scope and requirements

### P0 — pilot-critical requirements

#### FR-1: Authentication, session handling, and roles

- Users can sign in and sign out through a supported identity provider.
- The system maps authenticated users to a server-enforced role and profile.
- Protected APIs reject unauthenticated and unauthorized requests with clear errors.
- The UI routes users to the correct experience without relying solely on client-side role selection.
- Administrators can deactivate a user; deactivated users lose access promptly.

**Acceptance criteria**
- A driver cannot read or modify another driver’s routes or collection records.
- A non-admin cannot provision devices, manage users, or change global settings.
- Session expiry, sign-out, and failed authentication have clear user-facing states.

#### FR-2: Bin registry and device lifecycle

- Admins can create, edit, archive, and search bins.
- Every bin has a stable ID, human-readable name/location, latitude/longitude, capacity, status, device association, and current telemetry state.
- Admins can register a device to a bin and see its provisioning status, last successful update, and firmware/version metadata when available.
- Device provisioning secrets are encrypted or handled through a secure one-time flow; credentials must not be retrievable in plaintext after provisioning.
- A bin with stale or malformed telemetry is visually distinguishable from a healthy bin.

**Acceptance criteria**
- Invalid coordinates, duplicate IDs, impossible fill percentages, and invalid capacities are rejected.
- Archiving a bin preserves historical routes, alerts, and collections.
- Device identity/authentication is required before telemetry can update a bin.

#### FR-3: Telemetry ingestion and real-time state

- Devices or trusted integrations submit bin ID, timestamp, fill level, and optional weight, temperature, humidity, status, and location.
- The API validates type, range, timestamp freshness, device identity, and rate limits before storing an update.
- The latest accepted state and immutable telemetry history are persisted.
- Relevant screens receive real-time updates, with polling/retry fallback when sockets are unavailable.
- The system records rejected telemetry with a non-sensitive reason for diagnosis.

**Acceptance criteria**
- Duplicate/retried device messages do not create conflicting state or duplicate alerts.
- A failed database write never falsely reports a durable update as successful.
- The UI displays last-updated time and marks stale data based on a configurable interval.

#### FR-4: Alerting and incident workflow

- Configurable rules create alerts for at least high fill, overweight, high temperature, offline/stale device, and manually reported issues.
- Alerts have severity, source, affected bin/device, timestamp, status, owner, and audit history.
- Dispatchers can acknowledge, assign, resolve, and add notes to alerts.
- Urgent alerts can notify the responsible dispatcher and assigned driver through in-app real-time notifications; push/SMS/email integrations are optional only after reliability is proven.
- The system avoids repeat alert storms through threshold crossing, cooldown, and deduplication rules.

**Acceptance criteria**
- A bin crossing its fill threshold creates one active alert, not an alert on every telemetry update.
- A temperature/hazard alert is clearly differentiated from normal collection work and has an escalation path.
- Closing an alert never deletes the underlying telemetry or audit record.

#### FR-5: Operations map and bin monitoring

- Dispatchers can see active bins on a map and list, filter by fill level, alert severity, status, zone, device health, and service priority.
- Bin detail shows current state, trend/history, active alert(s), last collection, assigned route, and basic location information.
- The UI has useful empty, loading, error, and degraded-data states.
- Map markers and counts update without requiring a full page reload.

**Acceptance criteria**
- The bin list/map agree on the same filtered data set.
- A dispatcher can find an urgent bin by ID or location and reach its detail view in two interactions or fewer.

#### FR-6: Route optimization and dispatch

- Dispatchers select a planning depot, date/shift, eligible bins, available vehicles/drivers, capacities, and optional service priorities.
- The optimizer produces one or more feasible route proposals with stop order, estimated distance/time, load, unassigned bins, solver source, and assumptions.
- A dispatcher can review, edit, regenerate, save as draft, publish, reassign, cancel, and version a route.
- The system must prevent publishing infeasible routes and clearly identify bins that could not be assigned.
- Road-network distance/time must be used for production decisions when a map provider is available. If the system uses a fallback approximation, it must label the result as an estimate and require dispatcher confirmation.

**Acceptance criteria**
- Each published route starts/ends at its configured depot unless explicitly configured otherwise.
- A published route includes no duplicate active stop and does not exceed vehicle capacity.
- A route can be traced back to its optimization inputs and algorithm/version.
- Optimizer failure leaves existing published routes unchanged and provides a recoverable error.

#### FR-7: Driver workflow and proof of collection

- Drivers can view their active route, ordered stops, bin priority, contact/escalation instructions, and current progress.
- Drivers can start/pause/end a route and mark each stop collected, skipped, inaccessible, unsafe, or otherwise exceptioned.
- A collection event records time, driver, route, bin, result, optional notes/photo, and location when permitted.
- Route progress updates the dispatcher view in near real time.
- The workflow supports offline queueing and safe retry for basic status/collection events before mobile-app scope is considered complete.

**Acceptance criteria**
- A completed stop cannot be silently changed without an auditable correction.
- A skipped or hazardous stop produces an actionable dispatcher alert/exception.
- A driver sees only currently assigned work and safe, relevant bin metadata.

#### FR-8: Operational dashboard and reporting

- The dashboard shows total/active/stale bins, active alerts by severity, active routes, completion rate, unassigned urgent bins, and service exceptions.
- Supervisors can filter reports by time period, zone, vehicle, driver, and bin.
- Initial exports include bins, collections, alert history, and route completion in CSV.
- Metrics must be calculated from persisted records, not decorative/mock client-side values.

**Acceptance criteria**
- Dashboard totals reconcile to the underlying filtered records.
- Export respects the requester’s permissions and is auditable.

### P1 — post-pilot improvements

- Zone/geofence management and service-level policies.
- Road-aware ETA, live traffic, and route navigation deep links.
- Driver location history and route deviation alerts, subject to a published privacy policy.
- Photo evidence, QR/NFC bin identification, and barcode scanning.
- Configurable notifications through FCM, email, SMS, or WhatsApp using approved templates.
- Multi-depot, vehicle types, shift planning, driver availability, and disposal-site constraints.
- Historical fill-rate trends and demand forecasts.
- Richer analytics: fuel estimates, cost per collection, overflow risk, and route comparison.
- Hindi/Gujarati/localization review if serving multilingual field teams.

### P2 — future exploration

- Predictive routing based on fill forecasts and traffic.
- Citizen reporting and public transparency portal.
- Native driver apps.
- Third-party municipal, fleet, GPS, or weighing-scale integrations.
- Computer vision or image-based contamination detection.

---

## 5. Core user journeys

### Journey A: Add a connected bin

1. Admin creates a bin with location, capacity, zone, and required service settings.
2. Admin registers or securely associates a device.
3. Device authenticates, retrieves a one-time/protected configuration if needed, and sends a valid telemetry event.
4. Admin sees the bin as online with a last-seen timestamp; failures are diagnosable without exposing secrets.

### Journey B: React to an urgent bin

1. A valid telemetry update crosses a configured threshold or reports a hazard.
2. The system creates/deduplicates an alert, updates the map/list, and notifies the operational owner.
3. Dispatcher reviews severity, data freshness, and nearby/assigned route context.
4. Dispatcher adds the bin to a route or creates an emergency route.
5. Driver completes or exceptions the stop; the alert and collection trail reflect the outcome.

### Journey C: Plan and execute a collection shift

1. Dispatcher selects a depot, shift, fleet, drivers, eligible bins, capacities, and priorities.
2. System validates data and proposes feasible routes, including any unassigned bins and assumptions.
3. Dispatcher reviews/edits and publishes routes.
4. Drivers receive their route and update progress as stops are completed or exceptioned.
5. Supervisor reviews completion, exceptions, route performance, and data quality after the shift.

---

## 6. Data and integration requirements

### Minimum domain entities

| Entity | Minimum fields |
| --- | --- |
| User | ID, name, email/identity ID, role, status, created/updated timestamps |
| Driver profile | User ID, availability, assigned vehicle/shift, contact preferences |
| Vehicle | ID, capacity, type, status, depot, availability |
| Bin | ID, name, location/coordinates, capacity, zone, status, device ID, created/updated timestamps |
| Telemetry event | ID/idempotency key, bin ID, device ID, observed time, received time, fill/weight/temperature/humidity/status, validation outcome |
| Alert | ID, type, severity, state, source event, bin/device/route references, owner, timestamps, notes/history |
| Route | ID/version, shift date, depot/disposal point, driver/vehicle, ordered stops, load/distance/time estimates, state, optimization inputs/output |
| Route stop | Route ID, sequence, bin ID, planned state, actual result, timestamps, notes/evidence |
| Collection event | ID, bin/route/driver IDs, result, observed time, submitted time, location/evidence, correction history |
| Device | ID, bin association, auth identity, lifecycle state, last seen, firmware/version, provisioning audit |
| Audit event | Actor/system, action, entity, before/after summary, timestamp, request/correlation ID |

### External integrations

| Integration | MVP requirement | Guardrail |
| --- | --- | --- |
| Firebase or equivalent identity provider | Authentication and token/session verification | Keep client configuration separate from server credentials; enforce server-side authorization. |
| Supabase/Postgres or equivalent | Durable operational data, telemetry history, audit records | Schema migrations, backups, row-level/server access strategy, and monitored failures are required. |
| Socket.IO or equivalent | Best-effort real-time UI updates | REST/API reads remain the source of truth; reconnect and fallback behavior is required. |
| Map/routing provider | Road distance/time for production route proposals | Rate-limit, cache appropriately, show provider/fallback state, and handle outage gracefully. |
| ESP32 / device fleet | Signed/authenticated telemetry contract | Never rely on an unauthenticated bin ID or expose Wi-Fi/admin secrets in ordinary API responses. |

---

## 7. Non-functional requirements

### Reliability and data integrity

- Persist critical operational records before confirming success where feasible.
- Use idempotency keys or an equivalent strategy for telemetry, collection, and route-publication retries.
- Do not make in-memory state the sole record of a completed route, collection, device credential, or alert.
- Version API contracts and database migrations.
- Provide structured logs, correlation IDs, error monitoring, health/readiness endpoints, and backup/restore procedures.

### Security and privacy

- Keep all secrets in environment-managed configuration; do not commit credentials or use development default secrets in production.
- Authenticate devices and rate-limit/replay-protect telemetry endpoints.
- Use least-privilege roles, server-side authorization, secure cookies/tokens, input validation, and an audit log for privileged actions.
- Protect driver location and personal data; collect only what operations require, retain it for a defined period, and document access rules.
- Do not place Wi-Fi passwords, administrative keys, or service-account material in browser-delivered JavaScript, logs, exports, or routine API responses.

### Performance and scale

- Define pilot load explicitly before launch (number of bins, devices, concurrent dispatchers/drivers, telemetry interval, and planned route size).
- Under that load, keep normal dashboard/API interactions responsive and measure p95 latency.
- Bound optimizer work with timeout/cancellation and a clear fallback; never block the Node event loop on a long solve.
- Paginate/filter operational lists and avoid sending an unbounded telemetry history to the browser.

### Accessibility and usability

- Support keyboard navigation, visible focus states, semantic labels, readable contrast, responsive layouts, and non-color-only status communication.
- Use clear language for field workflows, optimistic states with rollback/error messages, and confirmation for destructive actions.
- Validate mobile/tablet use with drivers and dispatchers before treating the workflow as pilot-ready.

---

## 8. Current baseline and delivery gaps

The user has set the current project baseline at **10% complete**. The repository contains valuable exploratory assets—static login/admin/driver pages, a Node/Socket.IO server, a Python routing prototype, and tentative Firebase/Supabase/Mappls integrations—but these do not yet constitute a validated operational product.

### Observed prototype assets

- Static admin and driver dashboard UI prototypes.
- Basic bin/route/alert HTTP endpoints and Socket.IO event emission.
- A Python LNS-style CVRP prototype plus a JavaScript fallback solver.
- Tentative Firebase session handling, Supabase access, device provisioning, and mapping hooks.

### High-priority gaps to close before a pilot

1. **Define and enforce the data model.** There are no repository migrations/schema contracts or automated API/data validation tests.
2. **Secure identities and device access.** Several endpoints appear callable without role middleware; the current development fallback admin key and plaintext-style provisioning flow are not pilot-safe.
3. **Make persistence authoritative.** The server contains in-memory fallbacks for routes, alerts, device tokens, and collections. These are unsuitable as the primary operational record.
4. **Stabilize the runtime.** The repository needs an environment template, documented startup flow, a unified frontend/backend origin, deployment configuration, and health/readiness checks for external dependencies.
5. **Finish end-to-end flows.** Admin actions, route publication, driver collection/exception handling, and reporting must be tested from UI through durable storage and back.
6. **Validate routing.** The solver must accurately reject infeasible demand/capacity cases, use a clearly identified road-distance source, handle outages/timeouts, and expose inputs/output for review.
7. **Add test and quality gates.** There are currently no meaningful automated test scripts, linting, type checks, integration tests, or end-to-end tests defined in `package.json`.
8. **Resolve UX and maintainability defects.** The prototype has placeholder/“coming soon” actions, inconsistent file/link casing, missing referenced pages, and duplicate/overlapping endpoint/solver code that need consolidation.

---

## 9. Delivery plan from 10% to release

Percentages are planning checkpoints, not elapsed-time estimates. Each checkpoint is complete only when its acceptance criteria and quality gates pass.

| Cumulative target | Deliverable | Exit criteria |
| --- | --- | --- |
| 10% → 25% | Product foundation | Approved PRD/data model; environment template; schema migrations; role model; API contract; test/lint setup; secure configuration; local and preview startup documented. |
| 25% → 45% | Trusted operational data | Secure auth/RBAC; bin/device registry; validated telemetry ingestion; durable telemetry/alert storage; health monitoring; operations list/map with reliable empty/error states. |
| 45% → 65% | Dispatch MVP | Feasible optimizer contract; draft/review/publish route flow; driver assignment; route versioning; real-time updates; manual dispatcher override. |
| 65% → 80% | Field execution MVP | Responsive driver route workflow; collection/exception records; offline-safe retry strategy; alert acknowledgement/escalation; dispatcher progress view. |
| 80% → 90% | Pilot hardening | End-to-end test coverage for P0 flows; security review; load/recovery testing; observability; backup/restore rehearsal; accessibility review; real device test. |
| 90% → 100% | Controlled pilot release | UAT sign-off with operational users; training/runbook; deployment and rollback plan; live pilot metrics; documented incident/support ownership. |

### Suggested implementation order

1. Remove ambiguity in deployment/configuration and add a schema/API contract.
2. Secure all privileged, driver, and device actions before expanding UI capability.
3. Build the bin → telemetry → alert → map/list workflow end-to-end.
4. Build route draft → review → publish → driver assignment end-to-end.
5. Build driver completion/exception → supervisor reporting end-to-end.
6. Optimize and harden only after the basic workflow is reliable and instrumented.

---

## 10. Release gates and definition of done

The operational MVP is ready for a controlled pilot only when all of the following are true:

- All P0 requirements have demonstrable acceptance-test evidence.
- Authentication, authorization, device validation, and secret handling have been reviewed and tested.
- There is a migration-managed durable database; critical records do not depend on process memory.
- A real or representative device successfully completes provisioning/authentication and telemetry ingest.
- A dispatcher can complete a real end-to-end shift: identify urgent bins, create/review/publish routes, assign driver(s), monitor progress, and export/review outcomes.
- A driver can execute a route and safely record successful, skipped, and hazardous stops.
- Route feasibility, fallback behavior, and map-provider degradation are visible and tested.
- Automated tests cover critical authorization, input validation, telemetry, alert, route, and collection paths; CI blocks regressions.
- Monitoring, error reporting, backups, a support runbook, and a rollback plan are in place.
- Pilot users approve usability and operations leads accept the measured performance against the defined pilot load.

---

## 11. Decisions needed before implementation

1. What is the exact pilot geography, number of bins/devices, fleet size, telemetry frequency, and shift model?
2. Which data store, hosting environment, and map-routing provider are approved for production use?
3. What vehicles, capacities, depot/disposal constraints, and prioritization policies must the optimizer model?
4. Which alert thresholds/severity rules are operationally approved, and who owns acknowledgement/escalation?
5. What is the required identity/role source for admins, dispatchers, drivers, and devices?
6. Is a web-based responsive driver workflow sufficient for the pilot, or is offline-native mobile support a release requirement?
7. What evidence is required for a collection (tap, GPS, photo, QR/NFC scan, supervisor review)?
8. What retention, consent, and privacy rules apply to driver location, device telemetry, and operational audit data?
9. What baseline collection cost, distance, overflow rate, and service-level metrics will be used to measure value?

---

## 12. Assumptions and change control

- This PRD intentionally prioritizes a reliable operations pilot over a broad feature set.
- Any feature that changes dispatch safety, route feasibility, roles, device security, or personal-data handling requires explicit product and technical review.
- The roadmap should be revised after field discovery and pilot baseline data are collected.
- Completion should be reported by verified P0/P1 acceptance criteria, not by the presence of UI screens or prototype code.
