import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    timezoneId: "Asia/Manila",
    locale: "en-PH",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `pnpm build && PORT=${PORT} pnpm start`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    // Explicit values so the suite runs the same with or without a local .env.
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "postgres://crb:crb@localhost:5433/crb",
      NEXT_PUBLIC_APP_URL: baseURL,
      NEXT_PUBLIC_DEV_ROLE_SWITCHER: "true",
    },
  },
});
