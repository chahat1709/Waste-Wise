"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  defaultShowcaseConfiguration,
  type ShowcaseBin,
  type ShowcaseConfiguration,
  type ShowcaseDepot,
  type ShowcaseRoutePlan,
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

function normalizeConfiguration(value: unknown): ShowcaseConfiguration {
  if (!value || typeof value !== "object") return cloneDefaultConfiguration();
  const input = value as Record<string, unknown>;
  const depotInput = input.depot && typeof input.depot === "object" ? input.depot as Record<string, unknown> : {};
  const depot: ShowcaseDepot = {
    name: typeof depotInput.name === "string" ? depotInput.name.slice(0, 160) : defaultShowcaseConfiguration.depot.name,
    address: typeof depotInput.address === "string" ? depotInput.address.slice(0, 300) : defaultShowcaseConfiguration.depot.address,
    latitude: asFiniteNumber(depotInput.latitude),
    longitude: asFiniteNumber(depotInput.longitude),
  };
  const bins = Array.isArray(input.bins) ? input.bins.map(normalizeBin).filter((bin): bin is ShowcaseBin => Boolean(bin)).slice(0, 10) : [];
  const planInput = input.routePlan && typeof input.routePlan === "object" ? input.routePlan as Record<string, unknown> : null;
  const routePlan: ShowcaseRoutePlan | null = planInput && Array.isArray(planInput.orderedBinIds) && typeof planInput.id === "string"
    ? {
        id: planInput.id.slice(0, 80),
        orderedBinIds: planInput.orderedBinIds.filter((id): id is string => typeof id === "string").slice(0, 10),
        estimatedDistanceKm: typeof planInput.estimatedDistanceKm === "number" ? planInput.estimatedDistanceKm : 0,
        generatedAt: typeof planInput.generatedAt === "string" ? planInput.generatedAt : new Date().toISOString(),
        publishedAt: typeof planInput.publishedAt === "string" ? planInput.publishedAt : undefined,
      }
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
