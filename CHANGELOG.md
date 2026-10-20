# Changelog

All notable changes to Waste-Wise will be documented in this file.

## [1.2.0] – 2026-10-19

### Fixed
- **Rate limiting bug** — hardcoded 100 req/15 min per IP made the test suite (and real demo sessions) hit `429 Too Many Requests`. Now configurable via `RATE_LIMIT_MAX` env var (default unchanged for production).
- **Playwright flakiness** — `page.goto` waited for the full `load` event, which stalled on third-party CDN assets (Leaflet/Chart.js). Navigation now uses `domcontentloaded`.
- False `npm test` (was a placeholder that always errored) — now wired to the real Playwright suite.
- `.gitignore` gaps: `test-results/`, `.agents/` artifacts no longer untracked noise.

### Added
- **One-command demo seed** — `npm run demo:seed` loads 7 Ahmedabad bins (all ≥ 85% full) through the real `/updateBin` ingest path, firing `fullnessAlert` + `rerouteSuggestion` Socket.IO events. Demo now goes from fragile manual setup to one command.
- `tests/ww.spec.js` + `playwright.config.js` committed — **12/12 tests passing** covering health, seeded bins, CVRP on the road matrix, alerts, secret-403s, admin redirect, driver/bins/map flows, telemetry, fleet stats, and the forgot-password page.
- `citizen.html` / `citizen.js` — citizen-facing complaint portal.
- `design-tokens.css` — shared design token layer.
- `BLUEPRINT.md` (architecture spec) and `HACKATHON_PLAN.md` (demo playbook).

### Changed
- `ADMIN_KEY` no longer defaults to a dev key in `.env.example` documentation.
- README restructured: architecture diagram, feature matrix, project structure, plus full **API Summary** and **Frontend Route** tables.

## [1.1.0] – 2026-09

### Added
- Professional README with system architecture diagram, CVRP solver docs, and setup instructions.

### Fixed
- Research README — added explicit problem/hypothesis/goal statements for the event-driven CVRP reroute work.

## [1.0.0] – 2026-04

### Added
- Initial release: Smart Logistics & Routing Dashboard.
- Dual CVRP solver (Python LNS heuristic + optional Google OR-Tools) with Mappls road-distance API and Haversine fallback.
- Node.js/Express + Socket.IO backend: bin ingest (`/updateBin`), route assignment, driver tracking, ESP32 provisioning, alerts.
- Firebase auth with HTTP-only session cookies, Supabase persistence with in-memory fallback.
- Admin, driver, and bin-telemetry dashboards (vanilla JS + Leaflet + Chart.js).

[1.2.0]: https://github.com/chahat1709/Waste-Wise/compare/fee8e81...main
[1.1.0]: https://github.com/chahat1709/Waste-Wise/compare/8074eab...fee8e81
