import "server-only";

import { and, eq, gte, inArray, lt } from "drizzle-orm";

import { fromManilaLocal } from "@/lib/dates";
import type { Actor } from "@/server/auth/actor";
import { assertCan } from "@/server/auth/permissions";
import type { DbExecutor } from "@/server/db/client";
import { creditBalance, creditEntries, livePayment } from "@/server/db/queries/billing";
import { getPatient } from "@/server/db/queries/patients";
import { appointments, payments } from "@/server/db/schema";

import { NotFoundError } from "./errors";

const nextDay = (isoDate: string) => {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

/** A day's billable sessions at a branch, each with its payment if any. */
export async function listBillingDay(
  db: DbExecutor,
  actor: Actor,
  input: { branchId: string; date: string },
) {
  assertCan(actor, "billing:read", { branchId: input.branchId });
  const rows = await db
    .select({ appointment: appointments, payment: payments })
    .from(appointments)
    .leftJoin(payments, and(eq(payments.appointmentId, appointments.id), livePayment))
    .where(
      and(
        eq(appointments.branchId, input.branchId),
        gte(appointments.startsAt, fromManilaLocal(input.date, "00:00")),
        lt(appointments.startsAt, fromManilaLocal(nextDay(input.date), "00:00")),
        inArray(appointments.status, ["checked_in", "attended"]),
      ),
    )
    .orderBy(appointments.startsAt, appointments.staffId);
  return rows;
}

/** A patient's advance credit: balance (sum of the ledger) and entries. */
export async function getCreditLedger(db: DbExecutor, actor: Actor, patientId: string) {
  const record = await getPatient(db, patientId);
  if (!record) throw new NotFoundError();
  assertCan(actor, "credit:read", { branchId: record.patient.branchId });
  const [balance, entries] = await Promise.all([
    creditBalance(db, patientId),
    creditEntries(db, patientId),
  ]);
  return { balance, entries };
}
