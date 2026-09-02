import { describe, expect, it } from "vitest";

import {
  createLocalShowcaseRoute,
  defaultShowcaseConfiguration,
  MAX_SHOWCASE_BINS,
  isLocatedBin,
  orderedShowcaseBins,
  type ShowcaseConfiguration,
} from "./bins";

function configurationWithBins(): ShowcaseConfiguration {
  return {
    ...defaultShowcaseConfiguration,
    depot: { name: "Demo depot", address: "Ahmedabad", latitude: 23.0225, longitude: 72.5714 },
    bins: [
      { id: "BIN-FAR", name: "Far", address: "Far location", latitude: 23.08, longitude: 72.65, fillPercent: 50, capacityKg: null },
      { id: "BIN-NEAR", name: "Near", address: "Near location", latitude: 23.024, longitude: 72.573, fillPercent: 85, capacityKg: 120 },
      { id: "BIN-MID", name: "Mid", address: "Mid location", latitude: 23.04, longitude: 72.59, fillPercent: 75, capacityKg: 100 },
    ],
    routePlan: null,
    updatedAt: null,
  };
}

describe("real-bin showcase routing", () => {
  it("starts with the closest configured bin and includes each located bin once", () => {
    const plan = createLocalShowcaseRoute(configurationWithBins());

    expect(plan?.orderedBinIds).toEqual(["BIN-NEAR", "BIN-MID", "BIN-FAR"]);
    expect(plan?.estimatedDistanceKm).toBeGreaterThan(0);
  });

  it("does not create a route when no real map coordinates have been saved", () => {
    const plan = createLocalShowcaseRoute({
      ...configurationWithBins(),
      bins: [{ id: "BIN-01", name: "Address only", address: "Ahmedabad", latitude: null, longitude: null, fillPercent: 75, capacityKg: null }],
    });

    expect(plan).toBeNull();
  });

  it("keeps a saved bin visible if a locally stored route plan is stale", () => {
    const configuration = configurationWithBins();
    configuration.routePlan = {
      id: "R-AMD-DEMO-01",
      orderedBinIds: ["BIN-NEAR"],
      estimatedDistanceKm: 1,
      generatedAt: "2026-09-02T00:00:00.000Z",
    };

    expect(orderedShowcaseBins(configuration).map((bin) => bin.id)).toEqual(["BIN-NEAR", "BIN-FAR", "BIN-MID"]);
  });

  it("does not treat impossible manually entered coordinates as map pins", () => {
    expect(isLocatedBin({ id: "BIN-BAD", name: "Bad", address: "Ahmedabad", latitude: 123, longitude: 72.5, fillPercent: 50, capacityKg: null })).toBe(false);
  });

  it("uses a saved route order when presenting the same bins to a driver", () => {
    const configuration = configurationWithBins();
    configuration.routePlan = {
      id: "R-AMD-DEMO-01",
      orderedBinIds: ["BIN-MID", "BIN-FAR", "BIN-NEAR"],
      estimatedDistanceKm: 12.3,
      generatedAt: "2026-09-02T00:00:00.000Z",
    };

    expect(orderedShowcaseBins(configuration).map((bin) => bin.id)).toEqual(["BIN-MID", "BIN-FAR", "BIN-NEAR"]);
    expect(MAX_SHOWCASE_BINS).toBe(10);
  });
});
