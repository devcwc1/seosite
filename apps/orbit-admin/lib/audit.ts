import "server-only";

import { randomUUID } from "node:crypto";

import { auditLogsCollection } from "@/lib/db/mongo-collections";
import { logger } from "@/lib/logger";

/**
 * Append an entry to the audit log. Never throws — an audit failure must not
 * break the action it is recording, so errors are logged and swallowed.
 *
 * Stored in MongoDB (migration in progress). `actorId` is a plain user id with
 * no foreign key, so it accepts ids from whichever store currently owns users.
 */
export async function recordAudit(entry: {
  actorId: string | null;
  action: string;
  target?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await auditLogsCollection().insertOne({
      _id: randomUUID(),
      actorId: entry.actorId,
      action: entry.action,
      target: entry.target ?? null,
      metadata: entry.metadata ?? {},
      createdAt: new Date(),
    });
  } catch (error) {
    logger.error(
      { err: error, action: entry.action },
      "Failed to write audit log entry",
    );
  }
}
