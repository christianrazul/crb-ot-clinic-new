import "server-only";

import { and, asc, eq, gte, isNotNull, isNull, lt, sql } from "drizzle-orm";

import { PAYMENT_METHODS, type ReceivedByMethod } from "@/lib/payment-methods";

import type { DbExecutor } from "../client";
import { creditLedger, debtLedger, patients, payments, receiptCounters, branches } from "../schema";

/** Voided payments and credit entries stay on record but count for nothing (D-121). */
export const livePayment = isNull(payments.voidedAt);
export const liveCredit = isNull(creditLedger.voidedAt);
export const liveDebt = isNull(debtLedger.voidedAt);

export type PaymentRow = typeof payments.$inferSelect;
export type CreditEntryRow = typeof creditLedger.$inferSelect;
export type DebtEntryRow = typeof debtLedger.$inferSelect;

/** The balance is always the sum of the live ledger rows. */
export async function creditBalance(db: DbExecutor, patientId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${creditLedger.amountCentavos}), 0)` })
    .from(creditLedger)
    .where(and(eq(creditLedger.patientId, patientId), liveCredit));
  return Number(row?.total ?? 0);
}

/** Ledger rows oldest first, voided ones included (the UI shows them struck through). */
export function creditEntries(db: DbExecutor, patientId: string) {
  return db
    .select()
    .from(creditLedger)
    .where(eq(creditLedger.patientId, patientId))
    .orderBy(asc(creditLedger.createdAt), asc(creditLedger.id));
}

/** What the patient owes on their tab: the sum of the live debt rows (D-129). */
export async function debtBalance(db: DbExecutor, patientId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${debtLedger.amountCentavos}), 0)` })
    .from(debtLedger)
    .where(and(eq(debtLedger.patientId, patientId), liveDebt));
  return Number(row?.total ?? 0);
}

/** Debt rows oldest first, voided ones included. */
export function debtEntries(db: DbExecutor, patientId: string) {
  return (
    db
      .select()
      .from(debtLedger)
      .where(eq(debtLedger.patientId, patientId))
      // At the same moment, a session's charge comes before money paid against it.
      .orderBy(asc(debtLedger.createdAt), asc(debtLedger.type), asc(debtLedger.id))
  );
}

export async function paymentForAppointment(db: DbExecutor, appointmentId: string) {
  const [row] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.appointmentId, appointmentId), livePayment));
  return row ?? null;
}

/**
 * Takes the next gapless receipt number for a branch. Must run inside the same
 * transaction as the payment: the row lock makes concurrent payments wait, and
 * a rollback gives the number back.
 */
export async function takeReceiptNumber(tx: DbExecutor, branchId: string): Promise<string> {
  const [row] = await tx
    .update(receiptCounters)
    .set({ nextNumber: sql`${receiptCounters.nextNumber} + 1` })
    .where(eq(receiptCounters.branchId, branchId))
    .returning({ taken: sql<number>`${receiptCounters.nextNumber} - 1` });
  if (!row) throw new Error(`No receipt counter for branch ${branchId}`);
  const [branch] = await tx
    .select({ prefix: branches.receiptPrefix })
    .from(branches)
    .where(eq(branches.id, branchId));
  return `${branch?.prefix ?? "CRB"}-${row.taken}`;
}

/**
 * Money actually received in [from, to), per payment method: the part of each
 * session payment not covered by credit or left as debt, advance top-ups, and
 * debt paid off. The same money the dashboard counts as income (D-129), so the
 * methods add up to it. Every method is listed, zero or not.
 */
export async function receivedByMethod(
  db: DbExecutor,
  branchId: string,
  from: Date,
  to: Date,
): Promise<ReceivedByMethod> {
  const sessionPaid = sql`${payments.amountCentavos} - ${payments.creditAppliedCentavos} - ${payments.debtCentavos}`;
  const [sessions, topUps, settlements] = await Promise.all([
    db
      .select({
        method: payments.method,
        total: sql<string>`sum(${sessionPaid})`,
        n: sql<number>`count(*)`.mapWith(Number),
      })
      .from(payments)
      .innerJoin(patients, eq(payments.patientId, patients.id))
      .where(
        and(
          eq(payments.branchId, branchId),
          isNull(patients.deletedAt),
          livePayment,
          isNotNull(payments.method),
          sql`${sessionPaid} > 0`,
          gte(payments.createdAt, from),
          lt(payments.createdAt, to),
        ),
      )
      .groupBy(payments.method),
    db
      .select({
        method: creditLedger.method,
        total: sql<string>`sum(${creditLedger.amountCentavos})`,
        n: sql<number>`count(*)`.mapWith(Number),
      })
      .from(creditLedger)
      .innerJoin(patients, eq(creditLedger.patientId, patients.id))
      .where(
        and(
          eq(patients.branchId, branchId),
          isNull(patients.deletedAt),
          eq(creditLedger.type, "top_up"),
          liveCredit,
          isNotNull(creditLedger.method),
          gte(creditLedger.createdAt, from),
          lt(creditLedger.createdAt, to),
        ),
      )
      .groupBy(creditLedger.method),
    db
      .select({
        method: debtLedger.method,
        total: sql<string>`-sum(${debtLedger.amountCentavos})`,
        n: sql<number>`count(*)`.mapWith(Number),
      })
      .from(debtLedger)
      .innerJoin(patients, eq(debtLedger.patientId, patients.id))
      .where(
        and(
          eq(patients.branchId, branchId),
          isNull(patients.deletedAt),
          eq(debtLedger.type, "settlement"),
          liveDebt,
          gte(debtLedger.createdAt, from),
          lt(debtLedger.createdAt, to),
        ),
      )
      .groupBy(debtLedger.method),
  ]);
  const by = new Map(PAYMENT_METHODS.map((m) => [m, { totalCentavos: 0, count: 0 }]));
  for (const row of [...sessions, ...topUps, ...settlements]) {
    const entry = row.method && by.get(row.method);
    if (!entry) continue;
    entry.totalCentavos += Number(row.total ?? 0);
    entry.count += row.n;
  }
  return PAYMENT_METHODS.map((method) => ({ method, ...by.get(method)! }));
}
