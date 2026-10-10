import "server-only";

import { asc, eq, sql } from "drizzle-orm";

import type { DbExecutor } from "../client";
import { creditLedger, payments, receiptCounters, branches } from "../schema";

export type PaymentRow = typeof payments.$inferSelect;
export type CreditEntryRow = typeof creditLedger.$inferSelect;

/** The balance is always the sum of the ledger. */
export async function creditBalance(db: DbExecutor, patientId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${creditLedger.amountCentavos}), 0)` })
    .from(creditLedger)
    .where(eq(creditLedger.patientId, patientId));
  return Number(row?.total ?? 0);
}

/** Ledger rows oldest first. */
export function creditEntries(db: DbExecutor, patientId: string) {
  return db
    .select()
    .from(creditLedger)
    .where(eq(creditLedger.patientId, patientId))
    .orderBy(asc(creditLedger.createdAt), asc(creditLedger.id));
}

export async function paymentForAppointment(db: DbExecutor, appointmentId: string) {
  const [row] = await db.select().from(payments).where(eq(payments.appointmentId, appointmentId));
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
