import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pino from "pino";
import { Client } from "pg";

import { setMigrationComplete } from "./migration-state";

/**
 * Dedicated logger for the boot phase. It writes structured JSON straight to
 * stdout (fd 1) with a *synchronous* destination so that a fatal error is
 * guaranteed to be flushed before `process.exit(1)` — unlike the app logger,
 * which uses an async `pino-pretty` worker in development.
 */
const bootLogger = pino(
  {
    name: "orbit-migrate",
    level: process.env.LOG_LEVEL ?? "info",
    redact: {
      paths: ["DATABASE_URL", "*.DATABASE_URL", "connectionString"],
      censor: "[redacted]",
    },
  },
  pino.destination({ dest: 1, sync: true }),
);

/**
 * A stable 64-bit key for the migration advisory lock. Using
 * `hashtext('orbit_migrations')` on the Postgres side keeps the key derivation
 * in one place and identical across every booting instance, so only one process
 * runs migrations at a time while the others block on the lock.
 */
const LOCK_KEY_SQL = sql`hashtext('orbit_migrations')`;

/**
 * Acquire a cluster-wide advisory lock, run pending Drizzle migrations exactly
 * once, then flip the readiness flag. Safe to call from every booting instance:
 * they serialize on the advisory lock, and Drizzle skips already-applied
 * migrations.
 *
 * Failure behaviour is environment-dependent:
 *   - production: exit non-zero so an orchestrator can restart or halt rollout.
 *   - development: log a warning and let the dev server boot without a database
 *     (the readiness flag stays false, so /api/health reports 503). This keeps
 *     local UI work unblocked when Postgres isn't running.
 */
export async function runBootMigrations(): Promise<void> {
  const isProduction = process.env.NODE_ENV === "production";
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    if (isProduction) {
      bootLogger.error(
        { event: "migrate.config_error" },
        "DATABASE_URL is not set; cannot run boot migrations",
      );
      process.exit(1);
    }
    bootLogger.warn(
      { event: "migrate.skipped" },
      "DATABASE_URL is not set; skipping boot migrations (development)",
    );
    return;
  }

  // A dedicated client (not the shared pool) so the session-level advisory lock
  // is held on exactly the connection that runs the migrations.
  const client = new Client({ connectionString });
  const db = drizzle(client);

  try {
    await client.connect();

    bootLogger.info({ event: "migrate.lock_wait" }, "Acquiring migration lock");
    await db.execute(sql`SELECT pg_advisory_lock(${LOCK_KEY_SQL})`);

    bootLogger.info({ event: "migrate.start" }, "Running migrations");
    await migrate(db, { migrationsFolder: "./drizzle" });

    setMigrationComplete(true);
    bootLogger.info({ event: "migrate.complete" }, "Migrations complete");
  } catch (error) {
    const payload = {
      event: "migrate.failed",
      err:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : error,
    };

    if (isProduction) {
      bootLogger.error(payload, "Boot migrations failed");
      process.exit(1);
    }

    // Development: don't kill the dev server just because Postgres is down.
    bootLogger.warn(
      payload,
      "Boot migrations failed; continuing without a database (development). " +
        "Start Postgres and restart to apply migrations.",
    );
  } finally {
    // Always release the lock and close the connection, even on the success
    // path. `process.exit(1)` above short-circuits into here first.
    try {
      await db.execute(sql`SELECT pg_advisory_unlock(${LOCK_KEY_SQL})`);
    } catch (unlockError) {
      bootLogger.warn(
        { event: "migrate.unlock_failed", err: unlockError },
        "Failed to release migration advisory lock",
      );
    }
    await client.end().catch(() => undefined);
  }
}
