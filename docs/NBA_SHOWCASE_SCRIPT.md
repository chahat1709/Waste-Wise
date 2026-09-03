# Waste-Wise Ahmedabad Prototype — Showcase Script

This presentation prototype uses **your real dustbin locations** in one connected, role-aware workflow. It demonstrates a logical hand-off from setup to dispatch, field execution, and review without claiming live hardware, live notifications, GPS proof, production routing, or payroll processing.

## Before the presentation: add your real bins

1. Open `/setup` (or select **Configure real bins**).
2. Add up to **10** real dustbin IDs, names, and Ahmedabad addresses.
3. Enter a manual fill percentage and optional bin-capacity display note for each bin.
4. Select **Locate** for each bin, or select **Locate entered addresses**.
5. Confirm every pin on the OpenStreetMap preview. If an address is ambiguous, add latitude and longitude manually.
6. Select **Save real bins**, then **Download backup** to keep a JSON copy before presenting.

The bin IDs, names, addresses, coordinates, manual fill values, and capacity notes stay only in the current browser's local storage. Use the same browser/device for setup and the presentation.

## Start the prototype

```bash
cd apps/web
npm install
npm run dev -- --hostname 0.0.0.0
```

Open the site and select **Configure real bins first**. Leave `apps/web/.env.local` absent or empty to retain showcase mode.

## Suggested 4-minute walkthrough

### 1. Set the expectation — 20 seconds

On the landing page, say:

> “Waste-Wise connects actual bin locations, dispatcher decisions, driver execution, and administrative review. This showcase demonstrates the workflow while clearly separating local prototype records from live operations.”

Point out the four steps: **Configure → Assign → Execute → Review**.

### 2. Configure real bins — 35 seconds

1. Open **Configure real bins**.
2. Show an actual address, manual fill percentage, and its OpenStreetMap pin.
3. Explain that the map pin is shared by all later views.
4. Download the local backup if desired.

> “These are our real local bin locations. They remain in this browser and are not being sent to a Waste-Wise production system.”

### 3. Dispatcher: draft, assign, publish — 70 seconds

1. Open **Dispatch**.
2. Point out the map, the manual fill-level demand list, and the explicit route lifecycle.
3. Select **Build local route**.
4. Review the ordered real-bin sequence and the local-proximity disclaimer.
5. Enter a non-sensitive **Driver label** and **Vehicle label** for the showcase.
6. Select **Assign & publish to Driver**.

> “Dispatch first creates a reviewable route draft, then assigns and publishes it. In the production system, this step will use authenticated drivers, registered vehicles, road-network costs, capacity constraints, and a CVRP solver.”

### 4. Driver: start, resolve, hand off — 75 seconds

1. Open **Driver view**.
2. Show that stop addresses are hidden until **Start shift** is selected.
3. Start the shift and show the assigned stops.
4. Mark one stop **Collected**.
5. Mark another **Inaccessible** or **Damaged**, entering a short reason when prompted in the inline form.
6. Optionally record a road hazard or SOS, then return to Dispatch to show the local safety report.
7. Resolve every stop and select **End shift**.

> “Every stop needs an outcome before the local shift can finish. Exceptions keep their reason and remain visible to Dispatch. The outcomes are deliberately labelled manual and unverified; a production build will enforce the 50-metre GPS rule.”

### 5. HR / Admin: review, export, reset — 40 seconds

1. Open **HR & Admin**.
2. Show the same route ID, driver/vehicle labels, shift timing, stop counts, exceptions, and configured-bin registry.
3. Select **Download execution CSV** after the shift is complete.
4. Explain that the file is an execution showcase record, **not** a wage-approved payroll export.
5. If repeating the demo, select **Start a new local route**; bin locations remain saved while the completed route record is cleared.

### 6. Close — 10 seconds

> “The prototype proves a coherent workflow with our real bin locations. The next phase connects authenticated roles, trusted telemetry, GPS proof, real vehicle data, and validated road-aware routing without changing this hand-off.”

## Honest prototype boundary

State these points clearly if asked:

- Configured dustbin names, addresses, coordinates, fill levels, and capacity notes are real **user-entered local** showcase records.
- OpenStreetMap provides map tiles. Public Nominatim resolves addresses one at a time during setup; both require internet access. The browser has a fallback lookup and manual coordinate entry remains available.
- **Build local route** visits manually marked high-fill bins first, then uses nearest-neighbour straight-line proximity. It is not road routing, traffic ETA, truck-safe routing, vehicle-capacity logic, or CVRP optimization.
- Driver/vehicle labels, shift times, stop outcomes, hazards, and SOS reports are local presentation records. They are not authenticated personnel, live GPS, sensor telemetry, municipal notifications, or audit-grade production data.
- The Admin CSV is a local route-execution export only. Payroll, wages, accounts, vehicle registry, and server-side authorization remain future work.

## Demo reliability checklist

- Configure and locate all bins while online before presenting.
- Download the local JSON backup after setup.
- Use the same browser profile/device for all four workflow stages.
- Open the Dispatcher map once before presenting; keep a screenshot fallback if venue Wi-Fi is unreliable.
- Refreshing the page does **not** reset the saved route lifecycle or outcomes. To repeat a completed demo, use **Start a new local route** in HR / Admin.
- Do not edit bin details while a route is assigned, active, or completed; the setup screen locks those records so the hand-off remains consistent.
