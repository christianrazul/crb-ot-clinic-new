import "server-only";

import { and, eq, inArray, isNull, lt, sql } from "drizzle-orm";

import type { DbExecutor } from "../client";
import { appointments, debtLedger, payments } from "../schema";
import { liveDebt, livePayment } from "./billing";

/** Debt on each patient's tab: the sum of their live debt rows (D-129). */
export async function debtByPatient(db: DbExecutor, patientIds: string[]) {
  if (!patientIds.length) return new Map<string, number>();
  const rows = await db
    .select({
      patientId: debtLedger.patientId,
      total: sql<string>`sum(${debtLedger.amountCentavos})`,
    })
    .from(debtLedger)
    .where(and(inArray(debtLedger.patientId, patientIds), liveDebt))
    .groupBy(debtLedger.patientId);
  return new Map(
    rows.filter((r) => Number(r.total) > 0).map((r) => [r.patientId, Number(r.total)]),
  );
}

/**
 * What each patient owes: attended sessions before `before` with no payment,
 * plus their debt (sessions paid in part, the rest on their tab). Today's
 * unpaid sessions are "pending" at the desk, not owed yet. A session marked as
 * debt has a payment, so it is never counted twice.
 */
export async function owedByPatient(db: DbExecutor, patientIds: string[], before: Date) {
  if (!patientIds.length) return new Map<string, number>();
  const debt = await debtByPatient(db, patientIds);
  const rows = await db
    .select({
      patientId: appointments.patientId,
      owed: sql<string>`sum(${appointments.feeCentavos})`,
    })
    .from(appointments)
    .leftJoin(payments, and(eq(payments.appointmentId, appointments.id), livePayment))
    .where(
      and(
        inArray(appointments.patientId, patientIds),
        eq(appointments.status, "attended"),
        lt(appointments.startsAt, before),
        isNull(payments.id),
      ),
    )
    .groupBy(appointments.patientId);
  const owed = new Map(debt);
  for (const r of rows) owed.set(r.patientId, (owed.get(r.patientId) ?? 0) + Number(r.owed));
  return owed;
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
