import "server-only";

import { z } from "zod";

import { requireActor } from "@/server/auth/session";
import { takeRateLimit } from "@/server/auth/rate-limit";
import { getDb } from "@/server/db/client";
import { exportPatientData } from "@/server/services/patient-privacy";

const EXPORTS_PER_HOUR = 30;

/** One patient's data as JSON, for the owner. Rate limited per user. */
export async function exportPatient(rawId: unknown) {
  const actor = await requireActor();
  const patientId = z.string().min(1).max(64).parse(rawId);
  const db = getDb();
  if (!(await takeRateLimit(db, `export:${actor.userId}`, EXPORTS_PER_HOUR, 60 * 60_000))) {
    return { limited: true as const };
  }
  const data = await db.transaction((tx) => exportPatientData(tx, actor, patientId));
  return { limited: false as const, data, filename: `patient-${patientId}-export.json` };
}
