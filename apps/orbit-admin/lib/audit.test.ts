import { afterAll, describe, expect, it } from "vitest";

import { recordAudit } from "./audit";
import { auditLogsCollection } from "./db/mongo-collections";

/**
 * Integration against the dev MongoDB: recordAudit writes an entry and never
 * throws. The shared Mongo client is closed by test/setup.ts.
 */

const actions: string[] = [];

afterAll(async () => {
  if (actions.length) {
    await auditLogsCollection().deleteMany({ action: { $in: actions } });
  }
});

describe("recordAudit", () => {
  it("appends an entry to the Mongo audit log", async () => {
    const action = `test.audit.${Date.now()}`;
    actions.push(action);

    await recordAudit({
      actorId: "user-123",
      action,
      target: "thing:1",
      metadata: { changed: true },
    });

    const entry = await auditLogsCollection().findOne({ action });
    expect(entry?.actorId).toBe("user-123");
    expect(entry?.target).toBe("thing:1");
    expect(entry?.metadata).toEqual({ changed: true });
    expect(entry?.createdAt).toBeInstanceOf(Date);
  });

  it("accepts a null actor and defaults target/metadata", async () => {
    const action = `test.audit.null.${Date.now()}`;
    actions.push(action);

    await expect(
      recordAudit({ actorId: null, action }),
    ).resolves.toBeUndefined();

    const entry = await auditLogsCollection().findOne({ action });
    expect(entry?.actorId).toBeNull();
    expect(entry?.target).toBeNull();
    expect(entry?.metadata).toEqual({});
  });
});
