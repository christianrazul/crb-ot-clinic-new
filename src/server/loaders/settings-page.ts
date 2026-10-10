import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import { assertCan } from "@/server/auth/permissions";
import { getDb } from "@/server/db/client";
import { patients } from "@/server/db/schema";
import type { ShellSession } from "@/server/session/shell";

/** Settings data read from the database. Other sections move here in Milestone 6. */
export async function loadSettingsPage(session: ShellSession) {
  assertCan(session.actor, "settings:manage", { branchId: session.branch.id });
  const patientRows = await getDb()
    .select({
      id: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      service: patients.service,
      status: patients.status,
    })
    .from(patients)
    .where(and(eq(patients.branchId, session.branch.id), isNull(patients.deletedAt)))
    .orderBy(asc(patients.firstName), asc(patients.lastName));
  return { patients: patientRows };
}

export type SettingsPageData = Awaited<ReturnType<typeof loadSettingsPage>>;
