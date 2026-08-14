import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Only used by `migrate` / `push` / `studio`; `generate` works offline.
    url:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/orbit_admin",
  },
  strict: true,
  verbose: true,
});
