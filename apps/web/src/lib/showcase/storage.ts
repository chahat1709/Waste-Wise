"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  defaultShowcaseConfiguration,
  isShowcaseRouteLifecycle,
  isShowcaseStopStatus,
  type ShowcaseBin,
  type ShowcaseConfiguration,
  type ShowcaseDepot,
  type ShowcaseIncident,
  type ShowcaseRoutePlan,
  type ShowcaseStopRecord,
} from "@/lib/showcase/bins";

const STORAGE_KEY = "waste-wise-ahmedabad-showcase-v1";
const CHANGE_EVENT = "waste-wise-showcase-change";

type ConfigurationUpdate =
  | ShowcaseConfiguration
  | ((current: ShowcaseConfiguration) => ShowcaseConfiguration);

function cloneDefaultConfiguration(): ShowcaseConfiguration {
  return {
    ...defaultShowcaseConfiguration,
    depot: { ...defaultShowcaseConfiguration.depot },
    bins: [],
    routePlan: null,
  };
}

const serverSnapshot = cloneDefaultConfiguration();
let cachedRawValue: string | null | undefined;
let cachedConfiguration = serverSnapshot;

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown, maxLength: number, fallback = "") {
  return typeof value === "string" ? value.slice(0, maxLength) : fallback;
}

function normalizeBin(value: unknown): ShowcaseBin | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (typeof input.id !== "string" || typeof input.name !== "string" || typeof input.address !== "string") return null;

  return {
    id: input.id.slice(0, 80),
    name: input.name.slice(0, 160),
    address: input.address.slice(0, 300),
    latitude: asFiniteNumber(input.latitude),
    longitude: asFiniteNumber(input.longitude),
    fillPercent: typeof input.fillPercent === "number" && Number.isFinite(input.fillPercent)
      ? Math.max(0, Math.min(100, input.fillPercent))
      : 75,
    capacityKg: asFiniteNumber(input.capacityKg),
  };
}

function normalizeStopRecords(value: unknown, permittedIds: Set<string>): Record<string, ShowcaseStopRecord> {
  if (!value || typeof value !== "object") return {};
  const records: Record<string, ShowcaseStopRecord> = {};

  Object.entries(value as Record<string, unknown>).forEach(([binId, rawRecord]) => {
    if (!permittedIds.has(binId) || !rawRecord || typeof rawRecord !== "object") return;
    const record = rawRecord as Record<string, unknown>;
    if (!isShowcaseStopStatus(record.status)) return;
    records[binId] = {
      status: record.status,
      recordedAt: text(record.recordedAt, 80, new Date().toISOString()),
      verification: "showcase_unverified",
      note: typeof record.note === "string" && record.note.trim() ? record.note.slice(0, 300) : undefined,
    };
  });

  return records;
}

function normalizeIncidents(value: unknown): ShowcaseIncident[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((rawIncident) => {
    if (!rawIncident || typeof rawIncident !== "object") return [];
    const incident = rawIncident as Record<string, unknown>;
    if (incident.type !== "road_hazard" && incident.type !== "sos") return [];
    const type: ShowcaseIncident["type"] = incident.type === "sos" ? "sos" : "road_hazard";
    const id = text(incident.id, 80);
    if (!id) return [];
    return [{
      id,
      type,
      note: text(incident.note, 300, type === "sos" ? "SOS raised from Driver showcase" : "Road hazard reported from Driver showcase"),
      createdAt: text(incident.createdAt, 80, new Date().toISOString()),
      acknowledgedAt: typeof incident.acknowledgedAt === "string" ? incident.acknowledgedAt.slice(0, 80) : undefined,
    }];
  }).slice(0, 20);
}

function normalizeConfiguration(value: unknown): ShowcaseConfiguration {
  if (!value || typeof value !== "object") return cloneDefaultConfiguration();
  const input = value as Record<string, unknown>;
  const depotInput = input.depot && typeof input.depot === "object" ? input.depot as Record<string, unknown> : {};
  const depot: ShowcaseDepot = {
    name: text(depotInput.name, 160, defaultShowcaseConfiguration.depot.name),
    address: text(depotInput.address, 300, defaultShowcaseConfiguration.depot.address),
    latitude: asFiniteNumber(depotInput.latitude),
    longitude: asFiniteNumber(depotInput.longitude),
  };
  const bins = Array.isArray(input.bins)
    ? input.bins.map(normalizeBin).filter((bin): bin is ShowcaseBin => Boolean(bin)).slice(0, 10)
    : [];
  const planInput = input.routePlan && typeof input.routePlan === "object" ? input.routePlan as Record<string, unknown> : null;
  const routePlan: ShowcaseRoutePlan | null = planInput && Array.isArray(planInput.orderedBinIds) && typeof planInput.id === "string"
    ? (() => {
        const knownBinIds = new Set(bins.map((bin) => bin.id));
        const orderedBinIds = planInput.orderedBinIds
          .filter((id): id is string => typeof id === "string")
          .filter((id, index, values) => values.indexOf(id) === index)
          .filter((id) => knownBinIds.has(id))
          .slice(0, 10);
        // A route with no surviving saved bins cannot be executed; let the dispatcher rebuild it.
        if (orderedBinIds.length === 0) return null;
        const publishedAt = typeof planInput.publishedAt === "string" ? planInput.publishedAt.slice(0, 80) : undefined;
        const lifecycle = isShowcaseRouteLifecycle(planInput.lifecycle)
          ? planInput.lifecycle
          : publishedAt ? "published" : "draft";

        return {
          id: planInput.id.slice(0, 80),
          orderedBinIds,
          estimatedDistanceKm: typeof planInput.estimatedDistanceKm === "number" && Number.isFinite(planInput.estimatedDistanceKm)
            ? Math.max(0, planInput.estimatedDistanceKm)
            : 0,
          generatedAt: text(planInput.generatedAt, 80, new Date().toISOString()),
          assignment: {
            driverName: text((planInput.assignment as Record<string, unknown> | null)?.driverName, 120),
            vehicleLabel: text((planInput.assignment as Record<string, unknown> | null)?.vehicleLabel, 120),
          },
          lifecycle,
          stopRecords: normalizeStopRecords(planInput.stopRecords, new Set(orderedBinIds)),
          incidents: normalizeIncidents(planInput.incidents),
          publishedAt,
          startedAt: typeof planInput.startedAt === "string" ? planInput.startedAt.slice(0, 80) : undefined,
          endedAt: typeof planInput.endedAt === "string" ? planInput.endedAt.slice(0, 80) : undefined,
        };
      })()
    : null;

  return {
    depot,
    bins,
    routePlan,
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : null,
  };
}

export function readShowcaseConfiguration() {
  if (typeof window === "undefined") return serverSnapshot;
  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (rawValue === cachedRawValue) return cachedConfiguration;

  cachedRawValue = rawValue;
  try {
    cachedConfiguration = rawValue ? normalizeConfiguration(JSON.parse(rawValue)) : cloneDefaultConfiguration();
  } catch {
    cachedConfiguration = cloneDefaultConfiguration();
  }
  return cachedConfiguration;
}

export function saveShowcaseConfiguration(configuration: ShowcaseConfiguration) {
  const nextConfiguration: ShowcaseConfiguration = {
    ...configuration,
    updatedAt: new Date().toISOString(),
  };
  const rawValue = JSON.stringify(nextConfiguration);
  cachedRawValue = rawValue;
  cachedConfiguration = nextConfiguration;
  window.localStorage.setItem(STORAGE_KEY, rawValue);
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return nextConfiguration;
}

export function clearShowcaseConfiguration() {
  cachedRawValue = null;
  cachedConfiguration = cloneDefaultConfiguration();
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribeToShowcaseConfiguration(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CHANGE_EVENT, onStoreChange);
  };
}

export function useShowcaseConfiguration() {
  const configuration = useSyncExternalStore(
    subscribeToShowcaseConfiguration,
    readShowcaseConfiguration,
    () => serverSnapshot,
  );

  const updateConfiguration = useCallback((update: ConfigurationUpdate) => {
    const current = readShowcaseConfiguration();
    const next = typeof update === "function" ? update(current) : update;
    return saveShowcaseConfiguration(next);
  }, []);

  return { configuration, updateConfiguration };
}
