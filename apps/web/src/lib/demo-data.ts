import type { AlertItem, RouteStop } from "@/lib/domain";

export const routeStops: RouteStop[] = [
  {
    id: "BIN-1024",
    sequence: 1,
    name: "Civic Centre Gate",
    address: "West Loop Road · Sector 4",
    fillPercent: 96,
    weightKg: 188,
    status: "pending",
    eta: "09:18",
  },
  {
    id: "BIN-1081",
    sequence: 2,
    name: "River Market North",
    address: "Market Street · Zone B",
    fillPercent: 88,
    weightKg: 142,
    status: "pending",
    eta: "09:33",
  },
  {
    id: "BIN-1017",
    sequence: 3,
    name: "Library Square",
    address: "Cedar Avenue · Ward 2",
    fillPercent: 72,
    weightKg: 109,
    status: "pending",
    eta: "09:49",
  },
  {
    id: "BIN-1098",
    sequence: 4,
    name: "Station Service Lane",
    address: "Transit Road · Zone C",
    fillPercent: 91,
    weightKg: 163,
    status: "pending",
    eta: "10:05",
  },
];

export const alerts: AlertItem[] = [
  {
    id: "ALT-4901",
    severity: "critical",
    title: "Smoke signal detected",
    description: "Sensor reported smoke with a rapid temperature rise.",
    location: "Station Service Lane · BIN-1098",
    time: "2 min ago",
    acknowledged: false,
  },
  {
    id: "ALT-4897",
    severity: "high",
    title: "Lift-capacity risk",
    description: "Estimated bin weight is above the configured lift threshold.",
    location: "Civic Centre Gate · BIN-1024",
    time: "9 min ago",
    acknowledged: false,
  },
  {
    id: "ALT-4886",
    severity: "warning",
    title: "Device check-in overdue",
    description: "This device has not sent a valid telemetry update in 12 hours.",
    location: "Old Mill Road · BIN-0984",
    time: "43 min ago",
    acknowledged: true,
  },
];

export const fleet = [
  { id: "TRK-14", driver: "Arjun Patel", status: "On route", load: "2.8 / 5.0 t", progress: 56 },
  { id: "TRK-21", driver: "Meera Shah", status: "Loading", load: "1.1 / 4.0 t", progress: 28 },
  { id: "TRK-08", driver: "Karan Desai", status: "Available", load: "0.0 / 4.5 t", progress: 0 },
];

export const shiftRows = [
  { driver: "Arjun Patel", route: "R-2026-091", clockIn: "08:04", bins: 18, status: "Active" },
  { driver: "Meera Shah", route: "R-2026-094", clockIn: "08:17", bins: 12, status: "Active" },
  { driver: "Karan Desai", route: "R-2026-088", clockIn: "07:52", bins: 23, status: "Complete" },
];
