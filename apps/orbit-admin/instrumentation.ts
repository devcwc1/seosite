/**
 * Next.js instrumentation hook. `register()` runs once per server process
 * before any request is handled — the right place to prepare the database.
 *
 * For MongoDB that means ensuring the collections' indexes exist (idempotent),
 * which replaces the old Postgres boot-migration step. The driver pulls in Node
 * APIs that cannot run on the Edge runtime, so we gate on `NEXT_RUNTIME` and
 * import it dynamically only under Node.js.
 */
export async function register(): Promise<void> {
  // Never touch the database during `next build` (none is available then).
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { ensureIndexes } = await import("@/lib/db/mongo-indexes");
    const { setMigrationComplete } = await import("@/lib/db/migration-state");
    await ensureIndexes();
    setMigrationComplete(true);
  }
}
