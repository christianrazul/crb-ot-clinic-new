import "server-only";

import { asc, eq } from "drizzle-orm";

import type { DbExecutor } from "../client";
import { branches, userBranches } from "../schema";

export type BranchRow = typeof branches.$inferSelect;

export function listBranches(db: DbExecutor) {
  return db.select().from(branches).orderBy(asc(branches.code));
}

export async function getBranch(db: DbExecutor, id: string) {
  const [row] = await db.select().from(branches).where(eq(branches.id, id));
  return row ?? null;
}

/** Branches a user belongs to, main branch first. */
export function branchesForUser(db: DbExecutor, userId: string) {
  return db
    .select({ branch: branches })
    .from(userBranches)
    .innerJoin(branches, eq(userBranches.branchId, branches.id))
    .where(eq(userBranches.userId, userId))
    .orderBy(asc(branches.code))
    .then((rows) => rows.map((r) => r.branch));
}
