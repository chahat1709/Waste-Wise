import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import {
  enqueueOfflineCommand,
  listOfflineCommands,
  markOfflineCommandRetry,
  removeOfflineCommand,
} from "./outbox";

async function clearOutbox() {
  const commands = await listOfflineCommands();
  await Promise.all(commands.map((command) => removeOfflineCommand(command.id)));
}

describe("offline field-command outbox", () => {
  beforeEach(async () => {
    await clearOutbox();
  });

  it("persists a minimal idempotent command without authentication material", async () => {
    await enqueueOfflineCommand({
      id: "outbox-collection-1",
      type: "collection.record",
      idempotencyKey: "2f10f9ee-aecb-4ce5-b88c-8d4ef3e3f542",
      payload: { routeStopReference: "preview-stop-1", outcome: "collected" },
    });

    const commands = await listOfflineCommands();
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({
      id: "outbox-collection-1",
      type: "collection.record",
      retryCount: 0,
    });
    expect(commands[0].createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("tracks retries and removes only the completed command", async () => {
    await enqueueOfflineCommand({
      id: "outbox-hazard-1",
      type: "hazard.report",
      idempotencyKey: "7163b5ed-c80b-48ac-900f-1e5f27125407",
      payload: { kind: "unsafe_access" },
    });

    await markOfflineCommandRetry("outbox-hazard-1");
    expect((await listOfflineCommands())[0].retryCount).toBe(1);

    await removeOfflineCommand("outbox-hazard-1");
    expect(await listOfflineCommands()).toEqual([]);
  });
});
