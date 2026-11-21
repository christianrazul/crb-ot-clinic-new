import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { branches, patients } from "./clinic";
import { createdAt, id } from "./columns";
import { creditEntryTypeEnum, debtEntryTypeEnum, paymentMethodEnum } from "./enums";
import { appointments } from "./scheduling";

/**
 * One live payment per appointment. Rows are never deleted or edited: a
 * mistake is voided (once, with a reason) and, for a correction, a new payment
 * replaces it (D-121).
 */
export const payments = pgTable(
  "payments",
  {
    id: id(),
    appointmentId: text()
      .notNull()
      .references(() => appointments.id),
    patientId: text()
      .notNull()
      .references(() => patients.id),
    branchId: text()
      .notNull()
      .references(() => branches.id),
    amountCentavos: integer().notNull(),
    creditAppliedCentavos: integer().notNull().default(0),
    /** The part left unpaid and put on the patient's tab (D-129). */
    debtCentavos: integer().notNull().default(0),
    /** Null when credit and debt cover the whole fee, so no money changed hands. */
    method: paymentMethodEnum(),
    referenceNo: text(),
    cashReceivedCentavos: integer(),
    receiptNo: text().notNull().unique(),
    receivedByUserId: text()
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    /** The payment this one corrects, if any. */
    replacesPaymentId: text().references((): AnyPgColumn => payments.id),
    voidedAt: timestamp({ withTimezone: true, mode: "date" }),
    voidedByUserId: text().references(() => users.id),
    voidReason: text(),
  },
  (t) => [
    uniqueIndex("payments_one_live_per_appointment")
      .on(t.appointmentId)
      .where(sql`${t.voidedAt} is null`),
    index().on(t.patientId),
    index().on(t.branchId, t.createdAt),
    index().on(t.receivedByUserId),
    check(
      "payments_amounts",
      sql`${t.amountCentavos} >= 0 and ${t.creditAppliedCentavos} >= 0 and ${t.debtCentavos} >= 0 and ${t.creditAppliedCentavos} + ${t.debtCentavos} <= ${t.amountCentavos}`,
    ),
    check(
      "payments_method_when_due",
      sql`(${t.creditAppliedCentavos} + ${t.debtCentavos} = ${t.amountCentavos}) or ${t.method} is not null`,
    ),
    check(
      "payments_cash_covers",
      sql`${t.method} <> 'cash' or ${t.cashReceivedCentavos} >= ${t.amountCentavos} - ${t.creditAppliedCentavos} - ${t.debtCentavos}`,
    ),
    check(
      "payments_reference_for_non_cash",
      sql`${t.method} is null or ${t.method} = 'cash' or length(trim(coalesce(${t.referenceNo}, ''))) > 0`,
    ),
  ],
);

/**
 * Advance credit. The balance is always the sum of the live (not voided) rows.
 * Append-only apart from a one-time void (D-121).
 */
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
    /** The entry this one corrects, if any. */
    replacesEntryId: text().references((): AnyPgColumn => creditLedger.id),
    voidedAt: timestamp({ withTimezone: true, mode: "date" }),
    voidedByUserId: text().references(() => users.id),
    voidReason: text(),
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

/**
 * Debt: what a patient owes on their tab. A charge is the unpaid part of a
 * session's payment; a settlement is money received against it. The balance is
 * always the sum of the live rows and never goes below zero. Append-only apart
 * from a one-time void (D-121, D-129).
 */
export const debtLedger = pgTable(
  "debt_ledger",
  {
    id: id(),
    patientId: text()
      .notNull()
      .references(() => patients.id),
    type: debtEntryTypeEnum().notNull(),
    amountCentavos: integer().notNull(),
    description: text().notNull(),
    method: paymentMethodEnum(),
    referenceNo: text(),
    receiptNo: text().notNull(),
    notes: text(),
    /** The session payment that left this debt (charges only). */
    relatedPaymentId: text().references(() => payments.id),
    createdByUserId: text()
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
    voidedAt: timestamp({ withTimezone: true, mode: "date" }),
    voidedByUserId: text().references(() => users.id),
    voidReason: text(),
  },
  (t) => [
    index().on(t.patientId, t.createdAt),
    index().on(t.relatedPaymentId),
    index().on(t.createdByUserId),
    check(
      "debt_ledger_sign",
      sql`(${t.type} = 'charge' and ${t.amountCentavos} > 0 and ${t.relatedPaymentId} is not null) or (${t.type} = 'settlement' and ${t.amountCentavos} < 0 and ${t.method} is not null)`,
    ),
    check(
      "debt_ledger_settlement_reference",
      sql`${t.type} <> 'settlement' or ${t.method} = 'cash' or length(trim(coalesce(${t.referenceNo}, ''))) > 0`,
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
