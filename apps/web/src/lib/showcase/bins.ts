export const MAX_SHOWCASE_BINS = 10;

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

export interface ShowcaseRoutePlan {
  id: string;
  orderedBinIds: string[];
  estimatedDistanceKm: number;
  generatedAt: string;
  publishedAt?: string;
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

export function orderedShowcaseBins(configuration: ShowcaseConfiguration) {
  const byId = new Map(configuration.bins.map((bin) => [bin.id, bin]));
  const routeOrder = configuration.routePlan?.orderedBinIds ?? configuration.bins.map((bin) => bin.id);
  const ordered = routeOrder.map((id) => byId.get(id)).filter((bin): bin is ShowcaseBin => Boolean(bin));
  const includedIds = new Set(ordered.map((bin) => bin.id));

  // A partially stale local route must never hide one of the user's saved bins.
  return [...ordered, ...configuration.bins.filter((bin) => !includedIds.has(bin.id))];
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
 * It uses straight-line proximity and is not a road-aware or production CVRP solver.
 */
export function createLocalShowcaseRoute(configuration: ShowcaseConfiguration): ShowcaseRoutePlan | null {
  const locatedBins = configuration.bins.filter(isLocatedBin);
  if (locatedBins.length === 0) return null;

  const remaining = [...locatedBins];
  const ordered: ShowcaseBin[] = [];
  let totalDistanceKm = 0;
  let current = isLocatedDepot(configuration.depot)
    ? configuration.depot
    : remaining[0];

  while (remaining.length > 0) {
    let selectedIndex = 0;
    let selectedDistance = Number.POSITIVE_INFINITY;

    remaining.forEach((bin, index) => {
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
  };
}
