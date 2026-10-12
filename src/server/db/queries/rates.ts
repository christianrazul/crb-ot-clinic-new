import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import type { DbExecutor } from "../client";
import { branchRates, rateClasses } from "../schema";

/** Every role with its therapist share at one branch (0 if never set there). */
export function ratesForBranch(db: DbExecutor, branchId: string) {
  return db
    .select({
      id: rateClasses.id,
      name: rateClasses.name,
      shortName: rateClasses.shortName,
      service: rateClasses.service,
      sortOrder: rateClasses.sortOrder,
      therapistSharePct: sql<number>`coalesce(${branchRates.therapistSharePct}, 0)`.mapWith(Number),
    })
    .from(rateClasses)
    .leftJoin(
      branchRates,
      and(eq(branchRates.rateClassId, rateClasses.id), eq(branchRates.branchId, branchId)),
    )
    .orderBy(asc(rateClasses.sortOrder), asc(rateClasses.name));
}
export type BranchRate = Awaited<ReturnType<typeof ratesForBranch>>[number];

/** One role's therapist share at a branch, for payroll snapshots. */
export async function rateAt(db: DbExecutor, branchId: string, rateClassId: string) {
  const [row] = await db
    .select({ share: branchRates.therapistSharePct })
    .from(branchRates)
    .where(and(eq(branchRates.branchId, branchId), eq(branchRates.rateClassId, rateClassId)));
  return row ?? null;
}
