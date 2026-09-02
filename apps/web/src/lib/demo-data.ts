import type { AlertItem, RouteStop } from "@/lib/domain";

/**
 * Deliberately local, deterministic Ahmedabad showcase data.
 * Nothing in this file is fetched from a map, device, employee, or municipal system.
 */
export const routeStops: RouteStop[] = [
  {
    id: "BIN-AMD-1024",
    sequence: 1,
    name: "Navrangpura Bus Stand",
    address: "CG Road · Navrangpura",
    fillPercent: 96,
    weightKg: 188,
    status: "pending",
    eta: "09:18",
  },
  {
    id: "BIN-AMD-1081",
    sequence: 2,
    name: "Vastrapur Lake Gate",
    address: "Vastrapur · West Zone",
    fillPercent: 88,
    weightKg: 142,
    status: "pending",
    eta: "09:33",
  },
  {
    id: "BIN-AMD-1017",
    sequence: 3,
    name: "IIM Road Market",
    address: "Panjarapole · Ahmedabad",
    fillPercent: 72,
    weightKg: 109,
    status: "pending",
    eta: "09:49",
  },
  {
    id: "BIN-AMD-1098",
    sequence: 4,
    name: "Prahlad Nagar Crossroads",
    address: "SG Highway · Makarba",
    fillPercent: 91,
    weightKg: 163,
    status: "pending",
    eta: "10:05",
  },
];

export const alerts: AlertItem[] = [
  {
    id: "ALT-AMD-4901",
    severity: "critical",
    title: "Smoke signal detected",
    description: "Demo sensor reports smoke with a rapid temperature rise.",
    location: "Prahlad Nagar Crossroads · BIN-AMD-1098",
    time: "2 min ago",
    acknowledged: false,
  },
  {
    id: "ALT-AMD-4897",
    severity: "high",
    title: "Lift-capacity risk",
    description: "Demo bin estimate is above the configured lift threshold.",
    location: "Navrangpura Bus Stand · BIN-AMD-1024",
    time: "9 min ago",
    acknowledged: false,
  },
  {
    id: "ALT-AMD-4886",
    severity: "warning",
    title: "Device check-in overdue",
    description: "Demo device has not sent a valid telemetry update in 12 hours.",
    location: "Paldi Garden · BIN-AMD-0984",
    time: "43 min ago",
    acknowledged: true,
  },
];

export const fleet = [
  { id: "TRK-AMD-14", driver: "Arjun Patel", status: "On route", load: "2.8 / 5.0 t", progress: 56 },
  { id: "TRK-AMD-21", driver: "Meera Shah", status: "Loading", load: "1.1 / 4.0 t", progress: 28 },
  { id: "TRK-AMD-08", driver: "Karan Desai", status: "Available", load: "0.0 / 4.5 t", progress: 0 },
];

export const shiftRows = [
  { driver: "Arjun Patel", route: "R-AMD-091", clockIn: "08:04", bins: 18, status: "Active" },
  { driver: "Meera Shah", route: "R-AMD-094", clockIn: "08:17", bins: 12, status: "Active" },
  { driver: "Karan Desai", route: "R-AMD-088", clockIn: "07:52", bins: 23, status: "Complete" },
];

export const demoRouteSummary = {
  totalBins: 48,
  assignedTrucks: 3,
  totalDistanceKm: 36.4,
  estimatedDuration: "3 hr 18 min",
  distanceSavedPercent: 23,
  routeName: "R-AMD-091",
};
