import { sql } from "drizzle-orm";
import { check, date, index, integer, pgTable, text } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { branches, patients } from "./clinic";
import { createdAt, id } from "./columns";
import { creditEntryTypeEnum, paymentMethodEnum } from "./enums";
import { appointments } from "./scheduling";

/** One payment per appointment. Rows are never updated or deleted. */
export const payments = pgTable(
  "payments",
  {
    id: id(),
    appointmentId: text()
      .notNull()
      .unique()
      .references(() => appointments.id),
    patientId: text()
      .notNull()
      .references(() => patients.id),
    branchId: text()
      .notNull()
      .references(() => branches.id),
    amountCentavos: integer().notNull(),
    creditAppliedCentavos: integer().notNull().default(0),
    /** Null when credit covered the whole fee. */
    method: paymentMethodEnum(),
    referenceNo: text(),
    cashReceivedCentavos: integer(),
    receiptNo: text().notNull().unique(),
    receivedByUserId: text()
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.patientId),
    index().on(t.branchId, t.createdAt),
    index().on(t.receivedByUserId),
    check(
      "payments_amounts",
      sql`${t.amountCentavos} >= 0 and ${t.creditAppliedCentavos} between 0 and ${t.amountCentavos}`,
    ),
    check(
      "payments_method_when_due",
      sql`(${t.creditAppliedCentavos} = ${t.amountCentavos}) or ${t.method} is not null`,
    ),
    check(
      "payments_cash_covers",
      sql`${t.method} <> 'cash' or ${t.cashReceivedCentavos} >= ${t.amountCentavos} - ${t.creditAppliedCentavos}`,
    ),
    check(
      "payments_reference_for_non_cash",
      sql`${t.method} is null or ${t.method} = 'cash' or length(trim(coalesce(${t.referenceNo}, ''))) > 0`,
    ),
  ],
);

/** Advance credit. The balance is always the sum of the rows. Append-only. */
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: id(),
    patientId: text()
      .notNull()
      .references(() => patients.id),
    type: creditEntryTypeEnum().notNull(),
    amountCentavos: integer().notNull(),
    description: text().notNull(),
    method: paymentMethodEnum(),
    referenceNo: text(),
    receiptNo: text().notNull(),
    notes: text(),
    relatedPaymentId: text().references(() => payments.id),
    createdByUserId: text()
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.patientId, t.createdAt),
    index().on(t.relatedPaymentId),
    index().on(t.createdByUserId),
    check(
      "credit_ledger_sign",
      sql`(${t.type} = 'top_up' and ${t.amountCentavos} > 0) or (${t.type} = 'deduction' and ${t.amountCentavos} < 0) or (${t.type} = 'adjustment' and ${t.amountCentavos} <> 0)`,
    ),
    check(
      "credit_ledger_top_up_reference",
      sql`${t.type} <> 'top_up' or ${t.method} = 'cash' or length(trim(coalesce(${t.referenceNo}, ''))) > 0`,
    ),
  ],
);

/** Gapless receipt numbers per branch: lock the row, take next_number, increment. */
export const receiptCounters = pgTable("receipt_counters", {
  branchId: text()
    .primaryKey()
    .references(() => branches.id),
  nextNumber: integer().notNull().default(1),
});

export const expenses = pgTable(
  "expenses",
  {
    id: id(),
    branchId: text()
      .notNull()
      .references(() => branches.id),
    category: text().notNull(),
    amountCentavos: integer().notNull(),
    spentOn: date({ mode: "string" }).notNull(),
    description: text().notNull().default(""),
    createdByUserId: text().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.branchId, t.spentOn),
    index().on(t.createdByUserId),
    check("expenses_amount_positive", sql`${t.amountCentavos} > 0`),
  ],
);
