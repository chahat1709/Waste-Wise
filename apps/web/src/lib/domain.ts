export const roles = ["driver", "dispatcher", "admin"] as const;

export type Role = (typeof roles)[number];

export type AlertSeverity = "critical" | "high" | "warning" | "info";

export type RouteStopStatus = "pending" | "collected" | "inaccessible" | "damaged";

export interface RouteStop {
  id: string;
  sequence: number;
  name: string;
  address: string;
  fillPercent: number;
  weightKg: number;
  status: RouteStopStatus;
  eta: string;
}

export interface AlertItem {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  location: string;
  time: string;
  acknowledged: boolean;
}

export const roleLabels: Record<Role, string> = {
  driver: "Driver",
  dispatcher: "Dispatcher",
  admin: "HR / Admin",
};

export const roleRoutes: Record<Role, string> = {
  driver: "/driver",
  dispatcher: "/dispatch",
  admin: "/admin",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && roles.includes(value as Role);
}
