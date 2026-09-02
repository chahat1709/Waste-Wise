# Waste-Wise Ahmedabad Prototype — Showcase Script

This is a stable, local-first presentation prototype. It is designed to demonstrate the product workflow without requiring live hardware, a Google API key, Supabase credentials, external map access, or a network-dependent optimization call.

## Start the prototype

```bash
cd apps/web
npm install
npm run dev -- --hostname 0.0.0.0
```

Open the site and select **Start the 3-minute demo**. Leave `apps/web/.env.local` absent or empty to preserve local showcase mode.

## Suggested 3-minute walkthrough

### 1. Problem and promise — 20 seconds

On the landing page, introduce Waste-Wise as one connected workspace for a city waste operation:

> “Waste-Wise connects bin conditions, route decisions, field execution, and administration in one system. This Ahmedabad prototype shows the end-to-end user experience.”

### 2. Dispatcher — 60 seconds

1. Select **Dispatcher** on the workspace chooser.
2. Point out the Ahmedabad map, fill-level demand, safety alerts, and active demo fleet.
3. Click **Acknowledge** on a critical or high alert.
4. Click **Optimize demo routes**.
5. Wait for the local result card and say:

> “The system considers 48 bins, three vehicles, capacity, safety exclusions, and shift timing, then produces an assigned route set. In production, this deterministic demo step will call the selected routing/optimization provider.”

6. Click **Publish demo route**.

### 3. Driver — 55 seconds

1. Use the sidebar to select **Driver view**.
2. Click **Start shift** and point out the active location-sharing state.
3. Click **Collect** on the first stop.
4. Optionally click **Report road hazard** or **Trigger SOS** to demonstrate field safety escalation.

> “The driver sees only the assigned route, confirms service at each bin, and has a direct safety line to dispatch.”

### 4. HR / Admin — 35 seconds

1. Select **HR & Admin** in the sidebar.
2. Highlight the shift/payroll ledger, fleet capability, and role coverage.
3. Click **Export CSV**.

> “The operations record becomes payroll-ready administration data, rather than a separate manual process.”

### 5. Close — 10 seconds

> “The prototype demonstrates the complete user journey. The next step is connecting authenticated users, trusted sensor ingestion, and a Surat/Ahmedabad-validated routing provider without changing the workflow shown here.”

## Honest prototype boundary

State these points clearly if asked:

- All locations, alerts, vehicle states, route outputs, and payroll figures are deterministic local sample data.
- The Optimize action is a presentation simulation; it does not currently call Google, Mappls, HERE, or a custom CVRP solver.
- No employee, driver, sensor, vehicle, or municipal production data is displayed.
- The repository already includes a migration-ready security/data foundation for the later implementation, but this showcase does not require it to run.

## Demo reliability checklist

- Use a Chromium-based browser for the best PWA behavior.
- Start the local app before the presentation and open the Dispatcher view once to warm compilation.
- Keep the browser tab open; do not rely on external map tiles or third-party credentials.
- If the network drops, the core showcase continues because the map and route results are local UI data.
- Refresh the browser before each presentation to reset the acknowledgement, route, and collection states.
