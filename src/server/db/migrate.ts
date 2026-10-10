import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Applies pending migrations from ./drizzle. Run as a one-off step on deploy,
 * never on app boot (Milestone 13).
 */
export async function runMigrations(url: string) {
  const client = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  } finally {
    await client.end();
  }
}

/** CLI entry: `pnpm db:migrate`. */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env.");
    process.exit(1);
  }
  await runMigrations(url);
  console.log("Migrations applied.");
}

if (process.argv[1]?.endsWith("migrate.ts")) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
