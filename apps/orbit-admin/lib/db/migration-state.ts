/**
 * Boot-migration readiness flag.
 *
 * The flag is stashed on `globalThis` so the value set by the migration runner
 * (invoked from `instrumentation.ts`) is observable from route handlers such as
 * `/api/health`, even if Next builds them into separate module instances.
 */
const globalForMigration = globalThis as unknown as {
  __orbitMigrationComplete?: boolean;
};

/** Mark the boot migrations as finished (or reset the flag). */
export function setMigrationComplete(value: boolean): void {
  globalForMigration.__orbitMigrationComplete = value;
}

/** True once boot migrations have completed successfully. */
export function isMigrationComplete(): boolean {
  return globalForMigration.__orbitMigrationComplete === true;
}
