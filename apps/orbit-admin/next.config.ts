import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle for the Docker runtime image.
  output: "standalone",
  // Trace files from the monorepo root so workspace deps are included.
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
