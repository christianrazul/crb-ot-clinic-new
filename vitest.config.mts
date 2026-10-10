import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "src/**/*.test.ts"],
    // Run in a timezone far from Manila so tests catch accidental use of the
    // machine's local time.
    env: { TZ: "America/Los_Angeles" },
  },
});
