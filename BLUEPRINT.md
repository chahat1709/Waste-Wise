# Waste Wise — Working Blueprint

How the app actually works: runtime, pages, data, APIs, real-time events, solver, IoT.
Single backend. Single port. Everything below verified against the running server + 12 Playwright tests (`tests/ww.spec.js`).

## 1. System Overview

```
                        ┌──────────────────────────────────────────────┐
                        │  Node.js server (server.js) — port 5000      │
                        │  Express REST + Socket.IO + static frontend  │
                        └──────┬───────────────┬───────────────┬───────┘
                               │               │               │
                 ┌─────────────┘               │               └─────────────┐
                 ▼                             ▼                             ▼
        ┌────────────────┐          ┌────────────────────┐          ┌──────────────────┐
        │ Browsers       │          │ Python CVRP solver │          │ Cloud services   │
        │ gate / driver /│◄────────►│ cvrp_solver.py     │          │ Supabase (DB)    │
        │ bin / admin    │  spawn   │ OR-Tools → LNS     │          │ Firebase (auth)  │
        │ Leaflet +      │  stdin/  │ Mappls → OSRM →    │          │ OSRM (free roads)│
        │ Socket.IO      │  stdout  │ Haversine          │          │ EmailJS (contact)│
        └────────────────┘          └────────────────────┘          └──────────────────┘
                 ▲
                 │  POST /updateBin · GET /provision/:binId
        ┌────────────────┐
        │ ESP32 bins     │
        │ (sensors)      │
        └────────────────┘
```

- **One origin:** backend serves the frontend (`express.static`, `index.html` default), so pages, REST and Socket.IO share `http://localhost:5000`. No CORS pain in production.
- **Persistence:** Supabase when reachable; **in-memory fallback** (`bins`, `_inMemoryRoutes`, `_inMemoryAlerts`, …) when not — app stays demoable offline.
- **Research core:** `POST /updateBin` crossing fullness ≥ 80 immediately emits `fullnessAlert` + `rerouteSuggestion` over Socket.IO (event-driven reroute, no cron).

## 2. Runtime Topology

| Piece | Where | Notes |
|---|---|---|
| Backend | `server.js`, `PORT` (default 5000) | `npm start` → `node server.js` |
| Solver | `cvrp_solver.py` | Spawned per request, 30 s kill-switch, JSON over stdin/stdout |
| Frontend | `*.html` + `*.js` in project root | Served same-origin |
| Tests | `tests/ww.spec.js`, `playwright.config.js` | `npx playwright test` (12 tests, ~18 s) |
| Secrets | `.env` (never served) | Static middleware 403s `.env`, `.git`, `node_modules`, `*.py`, `*.log` |

## 3. Page Map & Navigation

```
index.html (gate)
├── [Driver Field] ──► dashboard.html        (NO login wall: demo driver-123, REQUIRE_AUTH=false)
└── [Admin Control] ──► inline admin form ──► admindashboard.html   (Firebase; demo admin@wastewise.com/admin123)
        (adminlogin.html = standalone equivalent of the inline form)

dashboard.html (driver field terminal)
├── Route tab (default) — map is home, assigned-route card, compute/assign controls
├── Bins tab — area table, row click ──► binStatus.html?binId=…
└── Alerts tab — live feed (Socket.IO + GET /alerts history)

binStatus.html — 4 live gauges (Chart.js) + Socket.IO subscribeBin
admindashboard.html — overview stats/charts, bins (provision+Wi-Fi), users, routes, monitoring
login.html / signup.html / forgot-password.html — Firebase email/Google flows (driver path currently bypassed by design)
admin.html — 302 redirects to admindashboard.html (legacy duplicate, kept as redirect)
```

## 4. Auth Flows

- **Driver:** no gate. `dashboard.js` `onAuthStateChanged` with `REQUIRE_AUTH=false` sets guest `driver-123` (localStorage + cookie) and loads. Logout just resets the demo identity and reloads. Flip one flag to re-enforce login.
- **Admin:** Firebase email/password (`index.js` inline form or `adminlogin.js` page) → `localStorage.adminLoggedIn` → `admindashboard.html`. Demo fallback `admin@wastewise.com / admin123` when Firebase unreachable.
- **Sessions (optional hardening):** `POST /sessionLogin {idToken}` verifies via Firebase Admin and sets HTTP-only `ww_session` cookie; `GET /sessionLogout` clears it. `verifySessionCookie` middleware exists for protecting routes later — currently routes stay open for demo.

## 5. Data Model

| Store | Shape | Lives in |
|---|---|---|
| Bin | `{id, bin_name, fullness, weight, temperature, humidity, lat, lng, location, status, updated_at}` | Supabase `bins` ↔ `bins{}` memory |
| Route | `{id, driverId, bins[{id,lat,lng}], startLocation, dumpyard, status:'assigned', createdAt, collectedBins[]}` | Supabase `routes` ↔ `_inMemoryRoutes[]` |
| Alert | `{type, bin, threshold/weight/reason, createdAt}` — types: `fullness`, `weightedFullness`, `hazard` | Supabase `alerts` ↔ `_inMemoryAlerts[]` |
| Collection | `{routeId, binId, driverId, collectedAt}` (+ in-route `collectedBins`) | Supabase `collections` ↔ `_inMemoryCollections[]` |
| Driver location | `{driverId, lat, lng, bearing, updatedAt}` | Supabase `driver_locations` ↔ `_inMemoryDriverLocations{}` |
| Device token | `{driverId, token, platform, createdAt}` (FCM push) | Supabase `device_tokens` ↔ `_inMemoryDeviceTokens{}` |
| Provision queue | `{binId: {ssid, wifiPassword, location, createdAt}}` | memory only (`provisionQueue`) |

## 6. REST API Contract

| Method | Path | Body / Query | Emits | Used by |
|---|---|---|---|---|
| GET | `/health` | — | — | gate stats, probes, tests |
| GET | `/api/config` | — | — | Firebase init (`login-auth.js`, `adminlogin.js`) |
| POST | `/sessionLogin` | `{idToken}` → sets `ww_session` | — | login flow |
| GET | `/sessionLogout` | — | — | logout |
| POST | `/updateBin` | `{id, fullness, weight, temp/temperature, humidity, lat, lng, location}` | `binData`, `binUpdate`, `fullnessAlert` + `rerouteSuggestion` (≥80), `weightedFullnessAlert` (≥80 & >12 kg), `hazardAlert` (≥60 °C / hazard status) | ESP32, tests, seeding |
| GET | `/bins` | — | — | driver table, admin, gate stats |
| GET | `/bins/:id` | — (memory fast-path first) | — | bin page bootstrap |
| POST | `/bins` | bin object (upsert, memory fallback) | `binData`, `binUpdate` | admin/provisioning |
| GET | `/nearby-bins?lat&lng&r` | BBOX query, default r=5000 m | — | smart-route bin picker |
| POST | `/assign-route` | `{driverId, bins[], startLocation, dumpyard}` | `routeAssigned` → driver room + routes room | driver assign, tests |
| GET | `/driver/:id/route` | latest `assigned` route | — | `refreshAssignedRoute()` |
| POST | `/driver/:id/location` | `{lat, lng, bearing}` | `driverLocation` (global) | Start-tracking pings (8 s) |
| POST | `/route/:id/collect` | `{binId, driverId, timestamp}` | `binCollected` → route + driver + routes rooms | collect buttons |
| GET | `/routes/history/:driverId` | — | — | history views |
| POST | `/optimize-route` | `{bins[], drivers[], vehicleCapacity, startLocation}` | `routeAssigned` per route | heuristic optimizer |
| POST | `/api/optimize-routes` | same as above, or solver payload | same | admin alias: bins→307 to `/optimize-route`, locations→solver |
| POST | `/api/cvrp` | `{locations, demands, vehicle_capacities, num_vehicles, depot}` | — | smart-route compute |
| GET | `/alerts?type&driverId&binId&since` | filters, DB→memory fallback | — | alerts tabs, gate stats |
| POST | `/provision` | `{binId, ssid, wifiPassword, location}` + `x-admin-key` | — | admin bin form |
| GET | `/provision/:binId` | 204 if empty (polled, kept until ack) | — | ESP32 setup |
| POST | `/provision/:binId/ack` | removes queue entry | — | ESP32 setup |
| POST | `/devices/register` | `{driverId, token, platform}` | — | push onboarding |

## 7. Socket.IO Event Catalog

Client → server: `subscribeBin(binId)` → joins `bin:{id}` (+ instant `binData` if cached); `subscribeDriver(id)` → `driver:{id}`; `subscribeRoutes()` → `routes` room.

Server → client:

| Event | Trigger | Payload highlights | Handled in |
|---|---|---|---|
| `binData` | any bin write | full bin object | `binstatus.js`, `dashboard.js` |
| `binUpdate` | any bin write | bin (also refreshes open tables) | `dashboard.js` |
| `routeAssigned` | route created | `{route}` + popup | `dashboard.js` |
| `binCollected` | collect ack | `{routeId, binId, driverId, collectedAt}` | `dashboard.js` (refresh) |
| `driverLocation` | location ping | `{driverId, lat, lng}` (own driver only) | `dashboard.js` marker |
| `fullnessAlert` | fullness crosses 80 | `{type, bin, threshold}` | `dashboard.js` feed + notification |
| `rerouteSuggestion` | same trigger | `{bin, reason, priority}` + auto-refresh of Route tab | `dashboard.js` |
| `weightedFullnessAlert` | ≥80 % and >12 kg, targeted at assigned driver | `{bin, weight}` + modal | `dashboard.js` |
| `hazardAlert` | ≥60 °C or hazard status, targeted + broadcast | `{bin, reason, temp}` + modal | `dashboard.js` |

## 8. Solver Pipeline (`POST /api/cvrp`)

```
payload {locations, demands, vehicle_capacities, num_vehicles, depot}
  │  (+ MAPPLS_API_KEY from env)
  ▼
runPythonSolver() — server.js (ONE spawn site, 30 s timeout)
  │  stdout JSON → return · error/non-JSON → jsFallbackCVRPSolve()
  ▼
cvrp_solver.py — distance matrix: Mappls → OSRM table → Haversine
  │  optimizer: OR-Tools (if installed) → LNS heuristic (200/500 iters)
  ▼
{routes:[{vehicle_id, nodes:[{index,lat,lng}], distance, load}], total_distance, algorithm, data_source}
```

- Verified: 7 Ahmedabad bins → `LNS`, `OSRM (Roads)`, 66.06 km over 2 vehicles.
- Frontend then draws **road-following** polylines: `dashboard.js fetchRoadGeometry()` calls OSRM `route/v1` per rendered route (white shadow + ink line), header shows true road km. LNS order + OSRM geometry share the same road matrix, so km agree.
- Known heuristic trait: LNS respects capacity but does **not** balance route lengths (observed 26 vs 40 km). Balance pass needed only if you scale up.

## 9. IoT (ESP32) Flows

- **Provision:** admin enters SSID/password with new bin → `POST /provision` (admin key) → device polls `GET /provision/:binId` → configures Wi-Fi → `POST /provision/:binId/ack` → queue cleared.
- **Telemetry:** device posts `POST /updateBin` → persisted (or memory) → rooms notified → threshold engine ( §6 ) → driver modals, feed, map re-render, optional FCM push via registered tokens.
- **Bin page:** `binStatus.html?binId=` bootstraps via `GET /bins/:id`, then lives on `subscribeBin`/`binData` + gauges.

## 10. Driver Operational Loop

1. Open `dashboard.html` → boot loads assigned route + nearby bins (`dashboard.js:1154` — previously missing, caught by Playwright).
2. Route tab: assigned card shows stops/remaining/road-km, progress bar, NEXT bin + Google-Maps navigate + one-tap collect; or pick nearby bins → Compute (CVRP) → Assign.
3. `START` begins 8 s location pings (`showDriverMarker`, cookie-cached, server broadcast).
4. Bin popup / NEXT button → `POST /route/:id/collect` → `binCollected` → route refreshes, progress advances.

## 11. Admin Operational Loop

`admindashboard.html` (`adminEnhanced.js`): Overview stats + Chart.js (collections, fill split) → Bins (add + Wi-Fi provision, table, CSV export, delete) → Users (mock list + modal CRUD) → Routes (analytics + Optimise All via `/api/optimize-routes`) → Monitoring (health dots, performance, live alerts, logs). Bins fall back to `GET /bins` when Supabase is empty/unreachable.

## 12. Configuration

`SUPABASE_URL/KEY · FIREBASE_API_KEY/AUTH_DOMAIN/PROJECT_ID/STORAGE_BUCKET/MESSAGING_SENDER_ID/APP_ID/MEASUREMENT_ID · FIREBASE_SERVICE_ACCOUNT(_PATH) · EMAILJS_* · SOCKET_IO_URL · ADMIN_KEY · MAPPLS_API_KEY · FULLNESS_ALERT_THRESHOLD (80) · FIRE_TEMP_THRESHOLD (60) · PORT (5000) · PYTHON_CMD (python)` — see `.env.example`. Only `firebaseConfig` is public via `/api/config`.

## 13. Failure Behaviour (by design)

Supabase down → memory + `db-fallback` flag, app fully demoable · Python missing/crash → JS greedy solver · OSRM/Mappls down → Haversine · Socket.IO down → pages still work via REST polling points (`loadBins`, `refreshAssignedRoute`, `loadAlerts`) · Firebase down → demo logins · No route → nearby-bins mode · No bins → empty states, not spinners.

## 14. Test Map (`npx playwright test`, 12/12)

health · seeded-bins-full · cvrp-road-matrix · alerts-fire · secrets-403 · admin-redirect · gate→driver · driver-no-login-wall+tabs · route-details-card · bin-telemetry · admin-stats · forgot-password-wired.

## 15. Non-Goals / Known Limits

No balanced-route optimisation · users/collections history partly mock · FCM needs real credentials + tokens · `verifySessionCookie` not yet enforced on routes · legacy dead files (`app.js`, `GaugeView.js`, `splash*.js`, `Translate.js`, `firebase-auth.js`, `email.js`, `contact-us.js`, orphan CSS) intentionally left unreferenced — archive to `_legacy/` on request.
