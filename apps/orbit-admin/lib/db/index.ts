import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy apps/orbit-admin/.env.example to .env and set it.",
  );
}

/**
 * Reuse a single pool across hot-reloads in development so we don't exhaust
 * Postgres connections. In production a fresh module instance is fine.
 */
const globalForDb = globalThis as unknown as { __orbitPool?: Pool };

export const pool =
  globalForDb.__orbitPool ?? new Pool({ connectionString });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__orbitPool = pool;
}

export const db = drizzle(pool, { schema });

export { schema };
export type Database = typeof db;
