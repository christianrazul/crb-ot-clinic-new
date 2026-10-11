import type { NextConfig } from "next";

/** Sent on every response. The CSP is set per request in src/proxy.ts (it needs a nonce). */
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  // Standalone output keeps the production Docker image small (Milestone 13).
  output: "standalone",
  // Pin the project root so a stray lockfile in a parent folder is never used
  // for bundling or standalone file tracing.
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
  typedRoutes: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
