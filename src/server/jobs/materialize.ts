import "server-only";

import { getDb } from "@/server/db/client";
import { materializeSeries } from "@/server/services/scheduling";

/** Runs the series job in one transaction and returns a summary for logs. */
export async function runMaterializeJob() {
  const result = await getDb().transaction((tx) => materializeSeries(tx));
  console.info(
    `[jobs] materialize: created ${result.created}, skipped ${result.skipped.length} taken slots`,
  );
  return { created: result.created, skipped: result.skipped.length };
}
