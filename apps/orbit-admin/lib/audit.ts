import "server-only";

import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { logger } from "@/lib/logger";

/**
 * Append an entry to the audit log. Never throws — an audit failure must not
 * break the action it is recording, so errors are logged and swallowed.
 */
export async function recordAudit(entry: {
  actorId: string | null;
  action: string;
  target?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      actorId: entry.actorId,
      action: entry.action,
      target: entry.target ?? null,
      metadata: entry.metadata ?? {},
    });
  } catch (error) {
    logger.error(
      { err: error, action: entry.action },
      "Failed to write audit log entry",
    );
  }
}
