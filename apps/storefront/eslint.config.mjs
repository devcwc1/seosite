import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * Storefront isolation policy.
 *
 * The storefront must consume Orbit data strictly through the `@orbit/next`
 * package. It may not open its own database connection, import the ORM, or reach
 * into another workspace app / its API internals. These bans make a violation a
 * lint error rather than a code-review catch.
 */
const ISOLATION_MESSAGE =
  "Storefront isolation: consume data strictly via the '@orbit/next' package — no direct DB, ORM, or cross-app API access.";

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "pg", message: ISOLATION_MESSAGE },
            { name: "postgres", message: ISOLATION_MESSAGE },
            { name: "drizzle-orm", message: ISOLATION_MESSAGE },
            { name: "@node-rs/argon2", message: ISOLATION_MESSAGE },
            { name: "pino", message: ISOLATION_MESSAGE },
          ],
          patterns: [
            {
              group: [
                "drizzle-orm/*",
                "pg/*",
                "**/apps/orbit-admin/**",
                "@orbit/admin",
                "@orbit/admin/*",
                "**/lib/db",
                "**/lib/db/*",
              ],
              message: ISOLATION_MESSAGE,
            },
          ],
        },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
