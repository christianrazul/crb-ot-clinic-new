import "server-only";

import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";

import type { DbExecutor } from "../client";
import { appointments, payments } from "../schema";

/**
 * What each patient owes: attended sessions before `before` with no payment.
 * Today's unpaid sessions are "pending" at the desk, not owed yet.
 */
export async function owedByPatient(db: DbExecutor, patientIds: string[], before: Date) {
  if (!patientIds.length) return new Map<string, number>();
  const rows = await db
    .select({
      patientId: appointments.patientId,
      owed: sql<string>`sum(${appointments.feeCentavos})`,
    })
    .from(appointments)
    .leftJoin(payments, eq(payments.appointmentId, appointments.id))
    .where(
      and(
        inArray(appointments.patientId, patientIds),
        eq(appointments.status, "attended"),
        lt(appointments.startsAt, before),
        isNull(payments.id),
      ),
    )
    .groupBy(appointments.patientId);
  return new Map(rows.map((r) => [r.patientId, Number(r.owed)]));
}

/** Attendance rate per patient: attended out of sessions held or missed before `before`. */
export async function attendanceByPatient(db: DbExecutor, patientIds: string[], before: Date) {
  if (!patientIds.length) return new Map<string, number | null>();
  const rows = await db
    .select({
      patientId: appointments.patientId,
      attended: sql<string>`count(*) filter (where ${appointments.status} = 'attended')`,
      counted: sql<string>`count(*) filter (where ${appointments.status} in ('attended', 'no_show'))`,
    })
    .from(appointments)
    .where(and(inArray(appointments.patientId, patientIds), lt(appointments.startsAt, before)))
    .groupBy(appointments.patientId);
  return new Map(
    rows.map((r) => [
      r.patientId,
      Number(r.counted) ? Math.round((Number(r.attended) / Number(r.counted)) * 100) : null,
    ]),
  );
}
