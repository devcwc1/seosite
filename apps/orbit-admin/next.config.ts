import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server bundle for the Docker runtime image.
  output: "standalone",
  // Trace files from the monorepo root so workspace deps are included.
  outputFileTracingRoot: path.join(__dirname, "../../"),
  experimental: {
    // Enables forbidden(), which answers a request the caller is
    // authenticated for but not authorised for with a real 403 rather than a
    // redirect. ORB-106 asks for the status code, not a bounce, so a probe
    // can tell "not allowed" apart from "not there".
    authInterrupts: true,
  },
};

export default nextConfig;
