/**
 * Next.js instrumentation hook. `register()` runs once per server process
 * before any request is handled — the right place to run boot migrations.
 *
 * The migration runner pulls in `pg`, which cannot run on the Edge runtime, so
 * we gate on `NEXT_RUNTIME` and dynamically import it only under Node.js.
 */
export async function register(): Promise<void> {
  // Never run migrations during `next build` (no database is available then).
  if (process.env.NEXT_PHASE === "phase-production-build") {
    return;
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runBootMigrations } = await import("@/lib/db/migrate");
    await runBootMigrations();
  }
}
