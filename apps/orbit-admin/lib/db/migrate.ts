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
 * migrations. On any failure the process exits non-zero so an orchestrator can
 * restart or halt the rollout.
 */
export async function runBootMigrations(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    bootLogger.error(
      { event: "migrate.config_error" },
      "DATABASE_URL is not set; cannot run boot migrations",
    );
    process.exit(1);
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
    bootLogger.error(
      {
        event: "migrate.failed",
        err:
          error instanceof Error
            ? { name: error.name, message: error.message, stack: error.stack }
            : error,
      },
      "Boot migrations failed",
    );
    process.exit(1);
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
