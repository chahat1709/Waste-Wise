import { z } from "zod";

/**
 * Shared boundary contracts for the web client and the future operations API.
 * Parsing belongs at the boundary; UI components should operate on typed values only.
 */
export const latitudeSchema = z.number().finite().gte(-90).lte(90);
export const longitudeSchema = z.number().finite().gte(-180).lte(180);

export const coordinateSchema = z.object({
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  accuracyMeters: z.number().finite().positive().max(10_000),
  capturedAt: z.string().datetime({ offset: true }),
});

export const collectionOutcomeSchema = z.enum(["collected", "inaccessible", "damaged", "not_found"]);

export const recordCollectionSchema = z.object({
  routeStopId: z.string().uuid(),
  outcome: collectionOutcomeSchema,
  location: coordinateSchema,
  note: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().uuid(),
});

export const reportHazardSchema = z.object({
  kind: z.enum(["road_blocked", "flooding", "accident", "unsafe_access", "other"]),
  location: coordinateSchema,
  note: z.string().trim().min(3).max(500),
  idempotencyKey: z.string().uuid(),
});

export const raiseSosSchema = z.object({
  shiftId: z.string().uuid(),
  location: coordinateSchema,
  idempotencyKey: z.string().uuid(),
});

export const telemetryEventSchema = z.object({
  deviceId: z.string().uuid(),
  observedAt: z.string().datetime({ offset: true }),
  sequence: z.number().int().nonnegative(),
  fillPercent: z.number().min(0).max(100).optional(),
  weightKg: z.number().nonnegative().max(100_000).optional(),
  smokeDetected: z.boolean().optional(),
  temperatureCelsius: z.number().finite().min(-50).max(150).optional(),
  batteryPercent: z.number().min(0).max(100).optional(),
}).refine(
  (event) =>
    event.fillPercent !== undefined ||
    event.weightKg !== undefined ||
    event.smokeDetected !== undefined ||
    event.temperatureCelsius !== undefined ||
    event.batteryPercent !== undefined,
  { message: "At least one telemetry measurement is required" },
);

export type Coordinate = z.infer<typeof coordinateSchema>;
export type RecordCollectionRequest = z.infer<typeof recordCollectionSchema>;
export type ReportHazardRequest = z.infer<typeof reportHazardSchema>;
export type RaiseSosRequest = z.infer<typeof raiseSosSchema>;
export type TelemetryEvent = z.infer<typeof telemetryEventSchema>;
