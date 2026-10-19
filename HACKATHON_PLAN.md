# Waste Wise — Hackathon Win Plan

Goal: **win**, not participate. This doc is the whole campaign: positioning, demo script,
build list, numbers to claim, pitch deck, risks, checklists, Q&A. Grounded in what the
app actually does today (see `BLUEPRINT.md`).

## 0. Win Thesis (read this first)

Most hackathon logistics projects are CRUD dashboards with fake data and a map screenshot.
Judges have seen 50 of them. We win on **three things they can't fake-check away**:

1. **A real algorithm** — LNS heuristic + OR-Tools, optimizing on a true *road-distance*
   matrix (OSRM), not straight lines. We can show the km difference live.
2. **A real architecture claim** — event-driven rerouting (IoT → Socket.IO → new route in
   ~seconds) vs the industry's cron-job batch routing. With a **live latency number on stage**.
3. **A complete system** — gate, driver terminal, admin control, bin telemetry, ESP32
   provisioning, auth, tests (12/12 Playwright). Nothing is a mockup.

Tagline: **"Bins that call the truck."** / Sub: *"From cron jobs to reflexes."*

## 1. Judging-Criteria Map

Typical hackathon rubric → where we score:

| Criterion (~weight) | Our weapon | Proof on stage |
|---|---|---|
| Innovation (25%) | Event-driven CVRP: fullness event → reroute suggestion → recompute, no polling | Live: seed full bin → alert + reroute in <2 s |
| Technical depth (25%) | LNS + OR-Tools, OSRM road matrix, Socket.IO rooms, graceful fallbacks at every layer | Solver output JSON + road-vs-straight km split |
| Impact (20%) | Fuel + overflow + fire-hazard response for real municipalities | Ahmedabad 7-bin run: 66.06 road-km, balanced story |
| Completeness/UX (15%) | 3 roles, 8 pages, token design system, mobile-usable driver terminal | Click through: gate → driver → collect → progress |
| Presentation (15%) | 5-min scripted demo + metrics slide + backup video | Rehearsed to the second (§3) |

## 2. Numbers We Claim (all honestly measurable on stage)

| Claim | Source | How to prove live |
|---|---|---|
| Reroute trigger in **~1–2 s** vs 15-min cron (≥99% faster trigger) | `POST /updateBin` → `rerouteSuggestion` socket event | Latency panel (§4, P0): timestamp emit→receive, show ms |
| Road routing finds **~40% more true km** than straight-line | Our test: same 3 stops 1170 m straight vs 1664 m OSRM | Show both numbers side by side from `/api/cvrp` `data_source` |
| Solver answers in **<2 s** for ward-scale (7 bins) | Timed run: 1.6–1.7 s measured | Run `POST /api/cvrp` live, read the clock |
| Live system, not slides | 12/12 Playwright suite, 17.8 s | Badge on slide; run once before judging, screenshot it |

> Never say ">85% latency reduction" without the live number beside it. The panel makes the claim self-proving.

## 3. The 5-Minute Demo Script (rehearse to the second)

Roles: one presenter + one "field operator" (phone/laptop as ESP32 + driver).

- **0:00–0:30 — Hook.** Driver dashboard on projector. Operator fires `POST /updateBin`
  (bin 96% full). Fullness modal + reroute suggestion pop **live**. "That bin just called the truck."
- **0:30–1:20 — Problem.** Fixed schedules → overflows + wasted fuel + fire risk nobody sees.
  One architecture diagram (BLUEPRINT §1). "Everyone else polls. We listen."
- **1:20–3:20 — Live loop.** (a) Assigned-route card: stops, road-km, NEXT bin, Navigate link.
  (b) Compute on 7 Ahmedabad bins → road-snapped route draws on map. (c) Driver taps
  collect → progress bar moves, `binCollected` event. (d) Hazard kicker: temp 62 °C bin →
  red broadcast modal.
- **3:20–4:10 — Tech depth (30 s each).** Solver JSON (`algorithm`, `data_source: OSRM (Roads)`).
  Latency panel number. Straight-vs-road km split. "12/12 automated tests" badge.
- **4:10–5:00 — Impact + close.** Municipal math (§6), pricing, roadmap (ward → city).
  Close on tagline + live map behind you.

Rules: no typing on stage except the one seed call (pre-script it as a bookmarklet/curl alias).
Everything else is clicks. Backup video covers any dead Wi-Fi (§7).

## 4. Build List (do in this order, stop when time runs out)

### P0 — must-have before the hackathon
- [ ] **Latency panel.** Stamp `t0` in `POST /updateBin`, echo it in the `rerouteSuggestion`
      payload; driver shows `received - t0` ms + a rolling avg. This is the trophy number.
      (~1 hr: `server.js` emit path + `dashboard.js` handler + tiny UI chip.)
- [ ] **One-command demo seed** (`npm run demo:seed`): 7 Ahmedabad bins full + assigned route
      for `driver-123`, so a fresh boot opens alive. (Today this is manual curl — fragile on stage.)
- [ ] **Straight-vs-road slide numbers**: script that solves the same stops both ways and prints
      both kms. Rehearse the exact figures; don't compute on stage.
- [ ] **Fresh-boot check**: kill server, `npm start`, open driver — route card + bins + map all
      populated with zero clicks (relies on P0 seed). Re-run `npx playwright test`.
- [ ] **Backup demo video** (2 min, screen capture of the §3 loop). Non-negotiable.
- [ ] **Admin analytics wired to real data**: Overview/Routes still show mock users/routes —
      wire counts to `GET /bins` + in-memory routes so judges clicking around see consistency.

### P1 — should-have
- [ ] Driver page on a real phone (judges will ask "does the driver use a phone?") — check
      touch targets (≥44 px), map height, collect flow over hotspot.
- [ ] Balance pass on LNS output (observed 26 vs 40 km split) — even a simple 2-opt or
      longest-route-first tweak is a good "tech depth" talking point.
- [ ] `GET /api/stats` single endpoint for gate numbers (bins/routes/alerts) instead of 2 fetches.
- [ ] README demo GIF (10 s loop of alert → reroute) for the repo judges browse.

### P2 — only if time
- [ ] Ward clustering note for 1000-bin scale (honest roadmap slide, not code).
- [ ] Archive legacy dead files to `_legacy/` (zero runtime effect today; cosmetic).

### Explicitly DO NOT build
Auth enforcement, FCM production push, dark mode, new pages. They don't win points; they create stage risk.

## 5. Pitch Deck (8 slides, 10 max)

1. Hook: live alert screenshot + "Bins that call the truck."
2. Problem: overflow / fuel / fire — municipal pain in one stat each.
3. Solution: architecture diagram + "event-driven, not cron."
4. **Live demo** (no slides — the app).
5. Tech depth: solver pipeline (matrix → LNS → road geometry) + latency number + test badge.
6. Metrics: the §2 table, measured not estimated.
7. Business: per-bin/per-truck SaaS, pilot-a-ward GTM, municipal + campus + gated-community wedge.
8. Team, roadmap (balance pass → clustering → city scale), ask. Close on tagline.

## 6. Impact Math (for slides 2 & 7 — label assumptions)

- A ward truck driving fixed beats daily vs on-demand full-bins-only: model 20–30% fewer km
  (show with our 66 km run: "these 7 full bins, one trip, zero wasted stops").
- Overflow complaints → near-zero for connected bins (event fires at 80%, before overflow).
- Fire response: 60 °C trigger → crew notified in seconds, not on next patrol.
- Price anchor: ₹X/bin/month + ₹Y/truck/month; pilot = 1 ward, 50 bins, 2 trucks.

## 7. Risk Plan (our fallbacks ARE the risk plan — say so on stage)

| What dies | What saves us | Rehearsed? |
|---|---|---|
| Venue Wi-Fi (OSRM/tiles) | Haversine fallback + cached tiles + **backup video** | must |
| Firebase blocked | Demo logins (`admin@…/admin123`, guest driver) | yes |
| Supabase down | In-memory mode (`db-fallback`, fully working) | yes |
| Python missing | JS greedy solver fallback in `runPythonSolver()` | yes |
| Geolocation denied | Cookie-cached location fallback | yes |
| Socket.IO blocked | REST polling points still render every panel | yes |
| Projector resolution | Big-type slides, 24 px minimum, high contrast | check |

Night-before: fresh `npm install`, seed, assign route, screenshot tests 12/12, record video,
charge everything, carry a phone hotspot. Day-of: one terminal running server, 3 tabs open
(driver, bin, admin), extra tabs closed, notifications allowed.

## 8. Q&A Bank (judges' likely shots + answers)

- **"Why not just use Google Maps / existing fleet software?"** — Cost per API call at municipal
  scale + no custom constraints (capacity, hazards, ESP32 events). OSRM is free; our layer is the
  event-driven brain, maps are interchangeable.
- **"Cron every minute is basically real-time, no?"** — Minute-cron still polls blind and
  recomputes the whole city; we push only on threshold events and only touch affected routes.
  Plus: cron can't push — our socket update is what the driver sees.
- **"Does your solver scale to 1000 bins?"** — Honestly: matrix is O(n²), LNS iters grow; production
  path is ward-level clustering first, then solve per cluster. That's the roadmap, and the
  architecture already supports it (stateless solver calls).
- **"Why LNS instead of exact methods?"** — Exact CVRP is NP-hard; wards need answers in ~2 s,
  not proofs. OR-Tools runs when installed; LNS otherwise; JS fallback guarantees an answer.
- **"Security?"** — Helmet, rate limiting, secrets never served (403-verified by test), session-cookie
  infra ready; demo runs open by choice, enforcement is one middleware away.
- **"Business moat?"** — Municipal pilots + hardware provisioning loop (our ESP32 flow) create
  switching costs; data on fill patterns becomes the asset.
- **"What breaks tomorrow?"** — Unbalanced routes at scale (stated openly, fix planned) and
  Supabase schema drift (memory fallback covers demos, migrations needed for prod).

## 9. T-Minus Timeline (phase-based — fits any deadline)

- **Build phase:** P0 items top-to-bottom, no new scope. End with full Playwright green.
- **Harden phase:** P1 phone test + video + straight-vs-road numbers locked. Freeze code.
- **Rehearse phase:** §3 script ×5 with timer. Break things on purpose (kill Wi-Fi, deny
  geo) and practice the fallback lines. Sleep.
- **Day:** seed → 3 tabs → tests screenshot → demo. Nobody codes on event day.

## 10. First Three Moves (do right now)

1. Latency panel (§4 P0 #1) — turns the thesis into a number.
2. `npm run demo:seed` (§4 P0 #2) — turns the demo from fragile to one command.
3. Record the backup video — turns every risk into a non-issue.

Say which move and it's built next.
