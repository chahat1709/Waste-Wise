import { openDB, type DBSchema } from "idb";

/**
 * A deliberately narrow local outbox for idempotent field commands.
 *
 * The worker never caches authenticated API responses. Instead, UI flows may enqueue
 * a minimal command here and replay it only after an authenticated API endpoint is
 * available. No access token, password, photo/blob, or precise historical GPS track
 * is persisted in this store.
 */
export type OfflineCommandType =
  | "collection.record"
  | "route-stop.skip"
  | "hazard.report"
  | "sos.raise";

export interface OfflineCommand<TPayload = Record<string, unknown>> {
  id: string;
  type: OfflineCommandType;
  createdAt: string;
  idempotencyKey: string;
  payload: TPayload;
  retryCount: number;
}

interface WasteWiseOfflineDb extends DBSchema {
  commands: {
    key: string;
    value: OfflineCommand;
    indexes: { "by-created-at": string };
  };
}

const DB_NAME = "waste-wise-offline";
const DB_VERSION = 1;

async function database() {
  return openDB<WasteWiseOfflineDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore("commands", { keyPath: "id" });
      store.createIndex("by-created-at", "createdAt");
    },
  });
}

export async function enqueueOfflineCommand<TPayload>(
  command: Omit<OfflineCommand<TPayload>, "createdAt" | "retryCount">,
) {
  const db = await database();
  const record: OfflineCommand<TPayload> = {
    ...command,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  await db.put("commands", record as OfflineCommand);
  return record;
}

export async function listOfflineCommands() {
  const db = await database();
  return db.getAllFromIndex("commands", "by-created-at");
}

export async function removeOfflineCommand(id: string) {
  const db = await database();
  await db.delete("commands", id);
}

export async function markOfflineCommandRetry(id: string) {
  const db = await database();
  const command = await db.get("commands", id);
  if (!command) return;
  await db.put("commands", { ...command, retryCount: command.retryCount + 1 });
}
