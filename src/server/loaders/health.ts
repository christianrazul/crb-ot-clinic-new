import "server-only";

import { sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";

/** True when the database answers within two seconds. */
export async function databaseIsUp(): Promise<boolean> {
  try {
    await Promise.race([
      getDb().execute(sql`select 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000)),
    ]);
    return true;
  } catch {
    return false;
  }
}
