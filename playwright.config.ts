import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;
export const E2E_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgres://crb:crb@localhost:5433/crb_e2e";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  // A separate database, migrated and seeded fresh for every run.
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL,
    timezoneId: "Asia/Manila",
    locale: "en-PH",
    trace: "on-first-retry",
    // Signed in as the clinic owner unless a test says otherwise.
    storageState: "tests/e2e/.auth/superadmin.json",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { storageState: { cookies: [], origins: [] } },
    },
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
    { name: "mobile", use: { ...devices["Pixel 7"] }, dependencies: ["setup"] },
  ],
  webServer: {
    command: `pnpm build && PORT=${PORT} pnpm start`,
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Explicit values so the suite runs the same with or without a local .env.
    env: {
      DATABASE_URL: E2E_DATABASE_URL,
      NEXT_PUBLIC_APP_URL: baseURL,
      BETTER_AUTH_SECRET: "e2e-only-secret-that-is-long-enough-1234",
      NEXT_PUBLIC_DEV_ROLE_SWITCHER: "false",
      E2E_TEST_MODE: "true",
      DEMO_NOW: "2026-08-22T10:20:00+08:00",
      // The standalone server binds to $HOSTNAME, which Docker sets to the
      // container id. Bind to every interface so localhost reaches it in CI.
      HOSTNAME: "0.0.0.0",
    },
  },
});
