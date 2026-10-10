import "server-only";

import { eq, sql } from "drizzle-orm";

import type { DbExecutor } from "@/server/db/client";
import { users } from "@/server/db/schema";

export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MINUTES = 15;

export function isLocked(user: { lockedUntil: Date | null }, now = new Date()): boolean {
  return Boolean(user.lockedUntil && user.lockedUntil > now);
}

/** Counts a failed password. The fifth in a row locks the account for 15 minutes. */
export async function recordFailedLogin(db: DbExecutor, userId: string, now = new Date()) {
  const lockUntil = new Date(now.getTime() + LOCKOUT_MINUTES * 60_000);
  const [row] = await db
    .update(users)
    .set({
      failedLoginCount: sql`case when ${users.failedLoginCount} + 1 >= ${MAX_FAILED_LOGINS} then 0 else ${users.failedLoginCount} + 1 end`,
      lockedUntil: sql`case when ${users.failedLoginCount} + 1 >= ${MAX_FAILED_LOGINS} then ${lockUntil.toISOString()}::timestamptz else ${users.lockedUntil} end`,
    })
    .where(eq(users.id, userId))
    .returning({ lockedUntil: users.lockedUntil });
  return {
    locked: isLocked({ lockedUntil: row?.lockedUntil ?? null }, now),
    lockedUntil: row?.lockedUntil ?? null,
  };
}

export async function clearFailedLogins(db: DbExecutor, userId: string) {
  await db
    .update(users)
    .set({ failedLoginCount: 0, lockedUntil: null })
    .where(eq(users.id, userId));
}
