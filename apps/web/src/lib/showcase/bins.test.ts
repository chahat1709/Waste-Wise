import { describe, expect, it } from "vitest";

import {
  areAllShowcaseStopsResolved,
  createLocalShowcaseRoute,
  defaultShowcaseConfiguration,
  getShowcaseStopCounts,
  getShowcaseStopStatus,
  isLocatedBin,
  isRouteLockedForSetup,
  MAX_SHOWCASE_BINS,
  orderedShowcaseBins,
  plannedShowcaseBins,
  routeLifecycleLabel,
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

function draftPlan(configuration: ShowcaseConfiguration) {
  const plan = createLocalShowcaseRoute(configuration);
  if (!plan) throw new Error("Expected a draft route plan");
  return plan;
}

describe("real-bin showcase routing", () => {
  it("starts with the closest configured bin and creates an unassigned draft", () => {
    const plan = draftPlan(configurationWithBins());

    expect(plan.orderedBinIds).toEqual(["BIN-NEAR", "BIN-MID", "BIN-FAR"]);
    expect(plan.estimatedDistanceKm).toBeGreaterThan(0);
    expect(plan.lifecycle).toBe("draft");
    expect(plan.assignment).toEqual({ driverName: "", vehicleLabel: "" });
    expect(plan.stopRecords).toEqual({});
    expect(plan.incidents).toEqual([]);
  });

  it("visits manually marked high-fill bins before nearer normal-fill bins", () => {
    const configuration = configurationWithBins();
    configuration.bins = [
      { id: "BIN-NEAR", name: "Near", address: "Near", latitude: 23.023, longitude: 72.572, fillPercent: 70, capacityKg: null },
      { id: "BIN-PRIORITY", name: "Priority", address: "Priority", latitude: 23.08, longitude: 72.65, fillPercent: 92, capacityKg: null },
    ];

    expect(draftPlan(configuration).orderedBinIds).toEqual(["BIN-PRIORITY", "BIN-NEAR"]);
  });

  it("does not create a route when no real map coordinates have been saved", () => {
    const plan = createLocalShowcaseRoute({
      ...configurationWithBins(),
      bins: [{ id: "BIN-01", name: "Address only", address: "Ahmedabad", latitude: null, longitude: null, fillPercent: 75, capacityKg: null }],
    });

    expect(plan).toBeNull();
  });

  it("requires complete, unique real-bin records before planning", () => {
    const configuration = configurationWithBins();
    configuration.bins[1].id = "BIN-FAR";
    expect(createLocalShowcaseRoute(configuration)).toBeNull();

    configuration.bins[1].id = "BIN-NEAR";
    configuration.bins[1].name = "";
    expect(createLocalShowcaseRoute(configuration)).toBeNull();
  });

  it("keeps a saved bin visible if a locally stored route plan is stale", () => {
    const configuration = configurationWithBins();
    configuration.routePlan = draftPlan(configuration);
    configuration.routePlan.orderedBinIds = ["BIN-NEAR"];

    expect(plannedShowcaseBins(configuration).map((bin) => bin.id)).toEqual(["BIN-NEAR"]);
    expect(orderedShowcaseBins(configuration).map((bin) => bin.id)).toEqual(["BIN-NEAR", "BIN-FAR", "BIN-MID"]);
  });

  it("counts stop outcomes and permits shift completion only when every stop is resolved", () => {
    const configuration = configurationWithBins();
    const plan = draftPlan(configuration);
    plan.stopRecords = {
      "BIN-NEAR": { status: "collected", recordedAt: "2026-09-02T00:00:00.000Z", verification: "showcase_unverified" },
      "BIN-MID": { status: "inaccessible", recordedAt: "2026-09-02T00:01:00.000Z", verification: "showcase_unverified", note: "Blocked access" },
    };

    expect(getShowcaseStopStatus(plan, "BIN-FAR")).toBe("pending");
    expect(getShowcaseStopCounts(plan)).toMatchObject({ pending: 1, collected: 1, inaccessible: 1, damaged: 0 });
    expect(areAllShowcaseStopsResolved(plan)).toBe(false);

    plan.stopRecords["BIN-FAR"] = { status: "damaged", recordedAt: "2026-09-02T00:02:00.000Z", verification: "showcase_unverified", note: "Lid damaged" };
    expect(areAllShowcaseStopsResolved(plan)).toBe(true);
  });

  it("does not treat impossible manually entered coordinates as map pins", () => {
    expect(isLocatedBin({ id: "BIN-BAD", name: "Bad", address: "Ahmedabad", latitude: 123, longitude: 72.5, fillPercent: 50, capacityKg: null })).toBe(false);
  });

  it("labels lifecycle stages honestly and locks bin editing after publication", () => {
    const plan = draftPlan(configurationWithBins());
    expect(routeLifecycleLabel("draft")).toBe("Draft route");
    expect(routeLifecycleLabel("in_progress")).toBe("Shift in progress");
    expect(isRouteLockedForSetup(plan)).toBe(false);

    plan.lifecycle = "published";
    expect(isRouteLockedForSetup(plan)).toBe(true);
    plan.lifecycle = "completed";
    expect(isRouteLockedForSetup(plan)).toBe(true);
    expect(MAX_SHOWCASE_BINS).toBe(10);
  });
});
