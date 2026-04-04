# Smart Logistics & Routing Dashboard

- **Status:** 🚧 Active R&D
- **Research Problem:** Monolithic solvers for CVRP execute as blocking batch-jobs, incapable of adapting dynamically to real-time IoT trigger events.
- **Working Hypothesis:** An event-driven architecture coupling a Python LNS heuristic directly to a Socket.IO real-time event bus will enable near-instantaneous stateful fleet rerouting.
- **Research Goal:** Reduce dynamic fleet rerouting latency by >85% compared to traditional Chron-job implementations.

A full-stack waste management and logistics platform featuring a mathematically complex **Capacitated Vehicle Routing Problem (CVRP)** solver integrated with real-time IoT monitoring, Firebase authentication, and Supabase persistence.

## Core Architecture

- **CVRP Solver (Python):** Dual-solver engine — custom Large Neighborhood Search (LNS) heuristic + Google OR-Tools integration. Supports Mappls (MapmyIndia) road-distance API with Haversine fallback.
- **Backend Server (Node.js):** 1000+ line Express server with Supabase, Firebase Admin, Socket.IO real-time events, rate limiting, session management, and ESP32 IoT device provisioning.
- **Driver Dashboard:** Real-time Leaflet maps, route visualization, bin collection confirmation, hazard alerts, and push notifications.
- **Admin Panel:** Full administrative dashboard for fleet management, route assignment, and bin monitoring.

## Technical Stack

- **Math/Algorithm:** Python (CVRP, LNS, Haversine, OR-Tools)
- **Backend:** Node.js, Express, Socket.IO, Supabase, Firebase Admin SDK
- **Frontend:** Vanilla JavaScript, Leaflet.js, HTML5/CSS3
- **IoT:** ESP32 device provisioning and sensor data ingestion
- **Auth:** Firebase Authentication with HTTP-only session cookies
