import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "drizzle", "dist"],
    setupFiles: ["./test/setup.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // Let server-only modules be imported directly in tests.
      "server-only": fileURLToPath(
        new URL("./test/server-only.stub.ts", import.meta.url),
      ),
    },
  },
});
