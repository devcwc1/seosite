// Load apps/orbit-admin/.env so integration tests get MONGODB_URI / MEDIA_DIR.
import "dotenv/config";

import { afterAll } from "vitest";

import { mongoClient } from "@/lib/db/mongo";

// The data layer opens a shared Mongo connection in whichever worker runs a
// test. Close it after each file so vitest's worker exits cleanly. The client
// is lazy, so this is a no-op when a file never touched Mongo, and safe if a
// test already closed it.
afterAll(async () => {
  try {
    await mongoClient.close();
  } catch {
    // already closed / never connected
  }
});
