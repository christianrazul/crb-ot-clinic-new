import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import type { DbExecutor } from "../client";
import { sessionTypeRateClasses, sessionTypes } from "../schema";

export type SessionTypeRow = typeof sessionTypes.$inferSelect & {
  /** Null means any rate class may run it. */
  allowedRateClassIds: string[] | null;
};

/** One branch's session types, with the roles allowed to run each. */
export async function listSessionTypes(
  db: DbExecutor,
  options: { branchId: string; includeInactive?: boolean },
) {
  const types = await db
    .select()
    .from(sessionTypes)
    .where(
      and(
        eq(sessionTypes.branchId, options.branchId),
        options.includeInactive ? undefined : eq(sessionTypes.active, true),
      ),
    )
    .orderBy(asc(sessionTypes.sortOrder), asc(sessionTypes.name));
  const links = types.length
    ? await db
        .select()
        .from(sessionTypeRateClasses)
        .where(
          inArray(
            sessionTypeRateClasses.sessionTypeId,
            types.map((t) => t.id),
          ),
        )
    : [];
  return types.map((type): SessionTypeRow => ({
    ...type,
    allowedRateClassIds: type.anyRateClass
      ? null
      : links.filter((l) => l.sessionTypeId === type.id).map((l) => l.rateClassId),
  }));
}
