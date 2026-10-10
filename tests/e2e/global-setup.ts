import { execFileSync } from "node:child_process";

import postgres from "postgres";

import { E2E_DATABASE_URL } from "../../playwright.config";

/** Recreates the e2e database and seeds the demo clinic before any test runs. */
export default async function globalSetup() {
  const target = new URL(E2E_DATABASE_URL);
  const admin = new URL(E2E_DATABASE_URL);
  admin.pathname = "/postgres";
  const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(`DROP DATABASE IF EXISTS "${target.pathname.slice(1)}" WITH (FORCE)`);
    await sql.unsafe(`CREATE DATABASE "${target.pathname.slice(1)}"`);
  } finally {
    await sql.end();
  }
  execFileSync("pnpm", ["db:seed"], {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: E2E_DATABASE_URL,
      SEED_PASSWORD: SEED_PASSWORD,
      NODE_ENV: "test",
    },
  });
}

export const SEED_PASSWORD = "e2e-demo-password";
