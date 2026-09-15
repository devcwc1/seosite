import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Next sets `jsx: "preserve"` in tsconfig because its own compiler handles
  // JSX. Vitest compiles the same files itself, so it needs a transform of
  // its own or every .tsx test fails to parse.
  plugins: [react()],
  test: {
    // Node by default: most suites talk to Postgres and want no DOM. Component
    // tests opt into a DOM per file with `// @vitest-environment jsdom`, which
    // keeps jsdom's startup cost off the suites that do not need it.
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
