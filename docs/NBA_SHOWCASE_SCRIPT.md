# Waste-Wise Ahmedabad Prototype — Showcase Script

This is a presentation prototype that combines **your real dustbin locations** with a polished role-based workflow. It does not require live hardware, Google credentials, Supabase credentials, or a production routing engine.

## Before the presentation: add your real bins

1. Start the app and open `/setup` (or select **Configure real bins** in the sidebar).
2. Add up to **10** real dustbin IDs, names, and Ahmedabad addresses.
3. Enter the current fill percentage and optional capacity for each bin.
4. Select **Locate** for each bin, or use **Locate entered addresses**.
5. Confirm every map pin on the OpenStreetMap preview. If an address is ambiguous, enter latitude and longitude manually.
6. Select **Save real bins**, then **Download backup** to save a JSON copy before the presentation.

The real bin IDs, names, addresses, coordinates, fill levels, and capacity notes are stored only in the current browser's local storage. Configure them in the same browser/device you will use to present.

## Start the prototype

```bash
cd apps/web
npm install
npm run dev -- --hostname 0.0.0.0
```

Open the site and select **Start the 3-minute demo**. Leave `apps/web/.env.local` absent or empty to keep showcase mode enabled.

## Suggested 3-minute walkthrough

### 1. Problem and promise — 20 seconds

On the landing page, introduce Waste-Wise as one connected workspace for a city waste operation:

> “Waste-Wise connects actual dustbin locations, collection decisions, field execution, and administration in one system. This Ahmedabad prototype shows the end-to-end user experience.”

### 2. Configure real bins — 35 seconds

1. Select **Add your real bins** or open **Configure real bins**.
2. Point out that each dustbin has its actual address, fill level, and map coordinates.
3. Show one or two pins on the OpenStreetMap preview.
4. Explain that the same saved locations appear in Dispatcher, Driver, and Admin screens.

> “For the demonstration, I configured real bin locations from our own area. The data stays locally in this browser, so no production information is exposed.”

### 3. Dispatcher — 55 seconds

1. Open **Dispatch**.
2. Point out the actual Ahmedabad bin pins, manually entered fill levels, and priority bins.
3. Select **Build local route**.
4. Wait for the local route result card.
5. Click **Publish to Driver view**.

> “The prototype takes the configured bin coordinates and creates a proximity-based visit order. This demonstrates the operational workflow; the production version will replace this with a traffic-aware vehicle-routing provider.”

### 4. Driver — 45 seconds

1. Use the sidebar to select **Driver view**.
2. Show the same real bin list and route order.
3. Click **Start shift** and point out the clearly labelled GPS-sharing preview state.
4. Click **Collect** on the first stop.
5. Optionally click **Report road hazard** or **Trigger SOS** to demonstrate field safety escalation.

> “The driver sees the assigned collection list, can confirm service at each real bin, and has a direct safety line to dispatch.”

### 5. HR / Admin — 25 seconds

1. Select **HR & Admin** in the sidebar.
2. Point out the real-bin registry card, which uses the same configured locations.
3. Highlight the presentation-only shift/payroll and access views.

### 6. Close — 10 seconds

> “The prototype proves the complete experience using real bin locations. The next step is connecting authenticated users, trusted sensor ingestion, and road-aware routing without changing this workflow.”

## Honest prototype boundary

State these points clearly if asked:

- Your configured dustbin names, addresses, coordinates, fill levels, and capacity notes are real local showcase records.
- OpenStreetMap displays the map tiles, and the public Nominatim service locates addresses one at a time during setup; both need an internet connection while those tasks are being used.
- **Build local route** is a simple nearest-neighbour, straight-line proximity order. It is not a real road route, traffic estimate, truck-safe route, or CVRP result.
- Workforce, fleet, payroll, alert, GPS-proof, hazard, and SOS states are presentation interactions, not live municipal operational data.
- No employee, driver, sensor, vehicle, account, or device data is sent to a production Waste-Wise backend in showcase mode.

## Demo reliability checklist

- Configure and locate all dustbins while online before the presentation.
- Download the local JSON backup after setup; it lets you recreate your bin list if browser storage is cleared.
- Use the same browser profile/device for setup and presentation because data is stored locally.
- Open the Dispatcher map once before presenting so the map tiles load; keep a screenshot of the map as a fallback if venue Wi-Fi is unreliable.
- Refresh the browser before each presentation to reset the route, collection, acknowledgement, and safety interaction states. Your saved bin setup remains.
