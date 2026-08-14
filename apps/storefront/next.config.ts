import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle for the Docker runtime image.
  output: "standalone",
  // Trace files from the monorepo root so workspace deps are included.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // `@orbit/next` ships TypeScript source (the sanctioned data layer); Next must
  // transpile it as part of the storefront build.
  transpilePackages: ["@orbit/next"],
};

export default nextConfig;
