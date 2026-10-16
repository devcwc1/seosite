/**
 * Startup readiness flag.
 *
 * Set once the boot step in `instrumentation.ts` has ensured the MongoDB
 * indexes exist. The flag is stashed on `globalThis` so it is observable from
 * route handlers such as `/api/health`, even if Next builds them into separate
 * module instances.
 */
const globalForMigration = globalThis as unknown as {
  __orbitMigrationComplete?: boolean;
};

/** Mark startup DB preparation as finished (or reset the flag). */
export function setMigrationComplete(value: boolean): void {
  globalForMigration.__orbitMigrationComplete = value;
}

/** True once startup DB preparation (index ensuring) has completed. */
export function isMigrationComplete(): boolean {
  return globalForMigration.__orbitMigrationComplete === true;
}
