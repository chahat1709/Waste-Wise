export const MAX_SHOWCASE_BINS = 10;

export const SHOWCASE_ROUTE_LIFECYCLES = ["draft", "published", "in_progress", "completed"] as const;
export type ShowcaseRouteLifecycle = (typeof SHOWCASE_ROUTE_LIFECYCLES)[number];

export const SHOWCASE_STOP_STATUSES = ["pending", "collected", "inaccessible", "damaged"] as const;
export type ShowcaseStopStatus = (typeof SHOWCASE_STOP_STATUSES)[number];

export interface ShowcaseDepot {
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

export interface ShowcaseBin {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  fillPercent: number;
  capacityKg: number | null;
}

export interface ShowcaseRouteAssignment {
  driverName: string;
  vehicleLabel: string;
}

export interface ShowcaseStopRecord {
  status: ShowcaseStopStatus;
  recordedAt: string;
  /** Collection proof is deliberately not claimed in the showcase. */
  verification: "showcase_unverified";
  note?: string;
}

export interface ShowcaseIncident {
  id: string;
  type: "road_hazard" | "sos";
  note: string;
  createdAt: string;
  acknowledgedAt?: string;
}

export interface ShowcaseRoutePlan {
  id: string;
  orderedBinIds: string[];
  estimatedDistanceKm: number;
  generatedAt: string;
  assignment: ShowcaseRouteAssignment;
  lifecycle: ShowcaseRouteLifecycle;
  stopRecords: Record<string, ShowcaseStopRecord>;
  incidents: ShowcaseIncident[];
  publishedAt?: string;
  startedAt?: string;
  endedAt?: string;
}

export interface ShowcaseConfiguration {
  depot: ShowcaseDepot;
  bins: ShowcaseBin[];
  routePlan: ShowcaseRoutePlan | null;
  updatedAt: string | null;
}

export const defaultShowcaseConfiguration: ShowcaseConfiguration = {
  depot: {
    name: "Collection depot",
    address: "",
    latitude: null,
    longitude: null,
  },
  bins: [],
  routePlan: null,
  updatedAt: null,
};

export function blankShowcaseBin(index: number): ShowcaseBin {
  return {
    id: `BIN-AMD-${String(index).padStart(2, "0")}`,
    name: "",
    address: "",
    latitude: null,
    longitude: null,
    fillPercent: 75,
    capacityKg: null,
  };
}

export function isShowcaseRouteLifecycle(value: unknown): value is ShowcaseRouteLifecycle {
  return typeof value === "string" && SHOWCASE_ROUTE_LIFECYCLES.includes(value as ShowcaseRouteLifecycle);
}

export function isShowcaseStopStatus(value: unknown): value is ShowcaseStopStatus {
  return typeof value === "string" && SHOWCASE_STOP_STATUSES.includes(value as ShowcaseStopStatus);
}

function hasValidCoordinates(latitude: number | null, longitude: number | null) {
  return Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude !== null && longitude !== null
    && latitude >= -90 && latitude <= 90
    && longitude >= -180 && longitude <= 180;
}

export function isLocatedBin(bin: ShowcaseBin): bin is ShowcaseBin & { latitude: number; longitude: number } {
  return hasValidCoordinates(bin.latitude, bin.longitude);
}

export function isLocatedDepot(depot: ShowcaseDepot): depot is ShowcaseDepot & { latitude: number; longitude: number } {
  return hasValidCoordinates(depot.latitude, depot.longitude);
}

export function routeLifecycleLabel(lifecycle: ShowcaseRouteLifecycle | null) {
  if (!lifecycle) return "Not planned";
  return {
    draft: "Draft route",
    published: "Assigned · awaiting shift",
    in_progress: "Shift in progress",
    completed: "Shift completed",
  }[lifecycle];
}

export function isRouteLockedForSetup(plan: ShowcaseRoutePlan | null) {
  return plan?.lifecycle === "published" || plan?.lifecycle === "in_progress" || plan?.lifecycle === "completed";
}

export function getShowcaseStopRecord(plan: ShowcaseRoutePlan | null, binId: string): ShowcaseStopRecord | null {
  return plan?.stopRecords[binId] ?? null;
}

export function getShowcaseStopStatus(plan: ShowcaseRoutePlan | null, binId: string): ShowcaseStopStatus {
  return getShowcaseStopRecord(plan, binId)?.status ?? "pending";
}

export function getShowcaseStopCounts(plan: ShowcaseRoutePlan | null) {
  const counts: Record<ShowcaseStopStatus, number> = {
    pending: 0,
    collected: 0,
    inaccessible: 0,
    damaged: 0,
  };
  if (!plan) return counts;

  plan.orderedBinIds.forEach((binId) => {
    counts[getShowcaseStopStatus(plan, binId)] += 1;
  });
  return counts;
}

export function areAllShowcaseStopsResolved(plan: ShowcaseRoutePlan | null) {
  return Boolean(plan && plan.orderedBinIds.length > 0 && getShowcaseStopCounts(plan).pending === 0);
}

/** Returns only bins included in the saved route plan, in its route order. */
export function plannedShowcaseBins(configuration: ShowcaseConfiguration) {
  const routePlan = configuration.routePlan;
  if (!routePlan) return [];

  const byId = new Map(configuration.bins.map((bin) => [bin.id, bin]));
  const seenIds = new Set<string>();
  return routePlan.orderedBinIds.flatMap((id) => {
    if (seenIds.has(id)) return [];
    seenIds.add(id);
    const bin = byId.get(id);
    return bin ? [bin] : [];
  });
}

/**
 * Shows route order when a plan exists, while preserving any locally saved bins
 * that were absent from a stale imported route plan.
 */
export function orderedShowcaseBins(configuration: ShowcaseConfiguration) {
  const plannedBins = plannedShowcaseBins(configuration);
  if (!configuration.routePlan) return configuration.bins;

  const includedIds = new Set(plannedBins.map((bin) => bin.id));
  return [...plannedBins, ...configuration.bins.filter((bin) => !includedIds.has(bin.id))];
}

function distanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Deliberately simple client-side visit ordering for the showcase only.
 * It visits manually marked high-fill bins first, then uses straight-line proximity; it is not a road-aware or production CVRP solver.
 */
export function createLocalShowcaseRoute(configuration: ShowcaseConfiguration): ShowcaseRoutePlan | null {
  const hasIncompleteOrUnmappedBin = configuration.bins.some((bin) => (
    !isLocatedBin(bin) || !bin.id.trim() || !bin.name.trim() || !bin.address.trim()
  ));
  // Duplicate IDs make stop outcomes ambiguous, so setup must resolve them before planning.
  if (
    configuration.bins.length === 0
    || hasIncompleteOrUnmappedBin
    || new Set(configuration.bins.map((bin) => bin.id)).size !== configuration.bins.length
  ) return null;

  const remaining = [...configuration.bins.filter(isLocatedBin)];
  const ordered: ShowcaseBin[] = [];
  let totalDistanceKm = 0;
  let current = isLocatedDepot(configuration.depot)
    ? configuration.depot
    : remaining[0];

  while (remaining.length > 0) {
    let selectedIndex = 0;
    let selectedDistance = Number.POSITIVE_INFINITY;
    const hasPriorityBin = remaining.some((bin) => bin.fillPercent >= 85);

    remaining.forEach((bin, index) => {
      // For the showcase, manually marked high-fill bins are visited before normal bins.
      // Within that group, the order is still simple straight-line nearest neighbour.
      if (hasPriorityBin && bin.fillPercent < 85) return;
      const candidateDistance = distanceKm(current, bin);
      if (candidateDistance < selectedDistance) {
        selectedDistance = candidateDistance;
        selectedIndex = index;
      }
    });

    const [nextBin] = remaining.splice(selectedIndex, 1);
    totalDistanceKm += selectedDistance;
    ordered.push(nextBin);
    current = nextBin;
  }

  if (isLocatedDepot(configuration.depot)) {
    totalDistanceKm += distanceKm(current, configuration.depot);
  }

  return {
    id: "R-AMD-DEMO-01",
    orderedBinIds: ordered.map((bin) => bin.id),
    estimatedDistanceKm: Number(totalDistanceKm.toFixed(1)),
    generatedAt: new Date().toISOString(),
    assignment: { driverName: "", vehicleLabel: "" },
    lifecycle: "draft",
    stopRecords: {},
    incidents: [],
  };
}
