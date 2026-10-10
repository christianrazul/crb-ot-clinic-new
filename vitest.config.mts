import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const serverOnlyStub = fileURLToPath(new URL("./tests/support/server-only.ts", import.meta.url));

export default defineConfig({
  resolve: { tsconfigPaths: true, alias: { "server-only": serverOnlyStub } },
  test: {
    // Run in a timezone far from Manila so tests catch accidental use of the
    // machine's local time.
    env: { TZ: "America/Los_Angeles" },
    projects: [
      {
        extends: true,
        test: { name: "unit", environment: "node", include: ["tests/unit/**/*.test.ts"] },
      },
      {
        extends: true,
        test: {
          name: "db",
          environment: "node",
          include: ["tests/db/**/*.test.ts"],
          // A real Postgres, created fresh, migrated and seeded once per run.
          globalSetup: ["tests/db/global-setup.ts"],
          fileParallelism: false,
          // Services read the validated env (clock, auth). Tests pass their own database handle.
          env: {
            TZ: "America/Los_Angeles",
            DATABASE_URL: "postgres://unused:unused@localhost:1/unused",
            NEXT_PUBLIC_APP_URL: "http://localhost:3000",
            BETTER_AUTH_SECRET: "test-only-secret-that-is-long-enough-1234",
            DEMO_NOW: "2026-08-22T10:20:00+08:00",
          },
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
