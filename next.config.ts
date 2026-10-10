import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output keeps the production Docker image small (Milestone 13).
  output: "standalone",
  // Pin the project root so a stray lockfile in a parent folder is never used
  // for bundling or standalone file tracing.
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
  typedRoutes: true,
  poweredByHeader: false,
};

export default nextConfig;
