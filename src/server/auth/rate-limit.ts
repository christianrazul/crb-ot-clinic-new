import "server-only";

import { sql } from "drizzle-orm";

import type { DbExecutor } from "@/server/db/client";

/**
 * Fixed-window counter in the database, so limits hold across restarts and
 * app instances. Returns false once `max` hits happen within `windowMs`.
 */
export async function takeRateLimit(
  db: DbExecutor,
  key: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  const now = Date.now();
  const rows = await db.execute<{ count: number }>(sql`
    insert into rate_limits (id, key, count, last_request)
    values (${crypto.randomUUID()}, ${key}, 1, ${now})
    on conflict (key) do update set
      count = case when rate_limits.last_request < ${now - windowMs} then 1 else rate_limits.count + 1 end,
      last_request = case when rate_limits.last_request < ${now - windowMs} then ${now} else rate_limits.last_request end
    returning count
  `);
  return Number(rows[0]?.count ?? 0) <= max;
}
