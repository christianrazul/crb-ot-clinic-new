import "server-only";

import { createDb } from "../client";
import { runMigrations } from "../migrate";
import { seed, truncateAll } from "./run-seed";

/**
 * `pnpm db:seed`: empties the database and loads the demo clinic.
 * Refuses to run in production unless --force is passed.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set. Copy .env.example to .env.");
    process.exit(1);
  }
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--force")) {
    console.error(
      "Refusing to seed a production database. This deletes all data. Pass --force if you mean it.",
    );
    process.exit(1);
  }

  await runMigrations(url);
  const { db, client } = createDb(url, { max: 1 });
  try {
    await truncateAll(db);
    const rows = await seed(db, { password: process.env.SEED_PASSWORD });
    console.log(
      `Seeded ${rows.branches.length} branches, ${rows.staff.length} staff, ${rows.patients.length} patients, ` +
        `${rows.appointments.length} appointments, ${rows.creditLedger.length} credit entries.`,
    );
    console.log(`Log in as ${rows.users.map((u) => u.email).join(", ")} with SEED_PASSWORD.`);
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
