import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { patients } from "@/server/db/schema";
import { lowCreditThreshold } from "@/server/services/payments";
import { loadSettings } from "@/server/services/settings";
import { listTeam } from "@/server/services/users";
import type { ShellSession } from "@/server/session/shell";

/** Every settings section, read from the database with the owner's permissions. */
export async function loadSettingsPage(session: ShellSession) {
  const db = getDb();
  const settings = await loadSettings(db, session.actor, session.branch.id);
  const patientRows = await db
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
  const branch = settings.branches.find((b) => b.id === session.branch.id)!;
  const lowCreditThresholdCentavos = await lowCreditThreshold(db);
  const team = await listTeam(db, session.actor);
  return { ...settings, patients: patientRows, branch, lowCreditThresholdCentavos, team };
}

export type SettingsPageData = Awaited<ReturnType<typeof loadSettingsPage>>;
