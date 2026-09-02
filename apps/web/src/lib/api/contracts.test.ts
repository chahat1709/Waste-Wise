import { describe, expect, it } from "vitest";

import {
  recordCollectionSchema,
  reportHazardSchema,
  telemetryEventSchema,
} from "./contracts";

const coordinates = {
  latitude: 21.1702,
  longitude: 72.8311,
  accuracyMeters: 18,
  capturedAt: "2026-09-02T08:42:00.000Z",
};

const idempotencyKey = "8ad8fc8d-7727-4f48-85cb-2b03192f0787";

describe("operations API contracts", () => {
  it("accepts a bounded collection proof with an idempotency key", () => {
    const result = recordCollectionSchema.safeParse({
      routeStopId: "b2cbe1a3-8a1e-4db0-885b-07ecb5c2e991",
      outcome: "collected",
      location: coordinates,
      idempotencyKey,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an impossible proof location and a note over the safety limit", () => {
    const result = reportHazardSchema.safeParse({
      kind: "road_blocked",
      location: { ...coordinates, latitude: 126 },
      note: "x".repeat(501),
      idempotencyKey,
    });

    expect(result.success).toBe(false);
  });

  it("requires at least one telemetry measurement", () => {
    const valid = telemetryEventSchema.safeParse({
      deviceId: "37fe4fbf-61b3-4815-ac6a-c6cf439390a7",
      observedAt: "2026-09-02T08:40:00.000Z",
      sequence: 43,
      fillPercent: 93.5,
      smokeDetected: false,
    });
    const emptyMeasurement = telemetryEventSchema.safeParse({
      deviceId: "37fe4fbf-61b3-4815-ac6a-c6cf439390a7",
      observedAt: "2026-09-02T08:40:00.000Z",
      sequence: 44,
    });

    expect(valid.success).toBe(true);
    expect(emptyMeasurement.success).toBe(false);
  });
});
