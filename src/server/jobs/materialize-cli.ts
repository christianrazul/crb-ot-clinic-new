import "server-only";

import { createDb } from "@/server/db/client";
import { materializeSeries } from "@/server/services/scheduling";

/** `pnpm jobs:materialize`, for cron on the server. */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const { db, client } = createDb(url, { max: 1 });
  try {
    const result = await db.transaction((tx) => materializeSeries(tx));
    console.log(
      `Created ${result.created} appointments; skipped ${result.skipped.length} taken slots.`,
    );
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
