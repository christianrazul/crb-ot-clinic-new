import "server-only";

import { asc, eq } from "drizzle-orm";

import type { DbExecutor } from "../client";
import { sessionTypeRateClasses, sessionTypes } from "../schema";

export type SessionTypeRow = typeof sessionTypes.$inferSelect & {
  /** Null means any rate class may run it. */
  allowedRateClassIds: string[] | null;
};

export async function listSessionTypes(
  db: DbExecutor,
  options: { includeInactive?: boolean } = {},
) {
  const [types, links] = await Promise.all([
    db
      .select()
      .from(sessionTypes)
      .where(options.includeInactive ? undefined : eq(sessionTypes.active, true))
      .orderBy(asc(sessionTypes.sortOrder), asc(sessionTypes.name)),
    db.select().from(sessionTypeRateClasses),
  ]);
  return types.map((type): SessionTypeRow => ({
    ...type,
    allowedRateClassIds: type.anyRateClass
      ? null
      : links.filter((l) => l.sessionTypeId === type.id).map((l) => l.rateClassId),
  }));
}
