import type { TestProject } from "vitest/node";
import postgres from "postgres";

import { createDb } from "@/server/db/client";
import { runMigrations } from "@/server/db/migrate";
import { seed } from "@/server/db/seed/run-seed";

/**
 * Creates a throwaway `crb_test` database next to the dev one, migrates and
 * seeds it. Needs Postgres running: `pnpm db:up` locally, a service in CI.
 */
export default async function setup(project: TestProject) {
  const url = process.env.TEST_DATABASE_URL ?? "postgres://crb:crb@localhost:5433/crb_test";
  const target = new URL(url);
  const name = target.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = "/postgres";

  const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
  try {
    await sql.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await sql.unsafe(`CREATE DATABASE "${name}"`);
  } catch (error) {
    throw new Error(
      `Could not reach Postgres at ${admin.host}. Start it with "pnpm db:up" (or set TEST_DATABASE_URL).\n${String(error)}`,
    );
  } finally {
    await sql.end();
  }

  await runMigrations(url);
  const { db, client } = createDb(url, { max: 1 });
  await seed(db);
  await client.end();

  project.provide("databaseUrl", url);
}

declare module "vitest" {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}
