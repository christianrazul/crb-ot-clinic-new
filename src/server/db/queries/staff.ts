import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import type { DbExecutor } from "../client";
import { rateClasses, staff } from "../schema";

export type StaffRow = typeof staff.$inferSelect;
export type RateClassRow = typeof rateClasses.$inferSelect;

/** Staff at a branch with their rate class, excluding soft-deleted ones. */
export function listStaff(db: DbExecutor, branchId: string) {
  return db
    .select({ staff, rateClass: rateClasses })
    .from(staff)
    .innerJoin(rateClasses, eq(staff.rateClassId, rateClasses.id))
    .where(and(eq(staff.branchId, branchId), isNull(staff.deletedAt)))
    .orderBy(asc(staff.sortOrder), asc(staff.displayName));
}

export async function getStaff(db: DbExecutor, id: string) {
  const [row] = await db
    .select({ staff, rateClass: rateClasses })
    .from(staff)
    .innerJoin(rateClasses, eq(staff.rateClassId, rateClasses.id))
    .where(eq(staff.id, id));
  return row ?? null;
}

export async function staffForUser(db: DbExecutor, userId: string) {
  const [row] = await db.select().from(staff).where(eq(staff.userId, userId));
  return row ?? null;
}

export function listRateClasses(db: DbExecutor) {
  return db.select().from(rateClasses).orderBy(asc(rateClasses.sortOrder), asc(rateClasses.name));
}
