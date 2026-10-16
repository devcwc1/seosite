import { MongoClient, type Db } from "mongodb";

/**
 * The MongoDB connection (migration in progress — ORB MongoDB move).
 *
 * Mirrors the pg pool in ./index.ts: a single shared `MongoClient` reused across
 * dev hot-reloads so a reloaded module doesn't open a fresh connection pool each
 * time. In production a new module instance per process is fine.
 *
 * The client connects lazily on first operation (driver v6+), so importing this
 * module does not open a socket; only a query does.
 */

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error(
    "MONGODB_URI is not set. Copy apps/orbit-admin/.env.example to .env and set it.",
  );
}

/**
 * The database name carried in the URI path (…/orbit_admin?…), falling back to
 * `orbit_admin`. Kept deliberately simple: our URIs always name the database.
 */
function dbNameFromUri(connectionUri: string): string {
  const path = (connectionUri.split("?")[0] ?? connectionUri).split("/").pop();
  return path && path.length > 0 ? path : "orbit_admin";
}

const globalForMongo = globalThis as unknown as {
  __orbitMongoClient?: MongoClient;
};

export const mongoClient =
  globalForMongo.__orbitMongoClient ?? new MongoClient(uri);

if (process.env.NODE_ENV !== "production") {
  globalForMongo.__orbitMongoClient = mongoClient;
}

export const mongoDbName = dbNameFromUri(uri);

/** The app database handle. Collections are accessed as `mongoDb.collection(…)`. */
export const mongoDb: Db = mongoClient.db(mongoDbName);
