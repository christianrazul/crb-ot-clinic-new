import "server-only";

import { addDays, format, parseISO } from "date-fns";
import { and, asc, eq, gt, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";

import { fromManilaLocal } from "@/lib/dates";
import { quotePayment } from "@/lib/payment";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-methods";
import type { ServiceKey } from "@/lib/services";
import {
  collectPaymentInput,
  lowCreditThresholdInput,
  topUpInput,
} from "@/lib/validation/payments";
import type { Actor } from "@/server/auth/actor";
import { assertCan } from "@/server/auth/permissions";
import { clinicNow } from "@/server/clock";
import type { DbExecutor } from "@/server/db/client";
import { writeAudit } from "@/server/db/queries/audit";
import { owedByPatient } from "@/server/db/queries/balances";
import { creditBalance, takeReceiptNumber } from "@/server/db/queries/billing";
import {
  appointments,
  branches,
  creditLedger,
  patients,
  payments,
  rateClasses,
  sessionTypes,
  staff,
} from "@/server/db/schema";

import { NotFoundError, ValidationError } from "./errors";

const PAYABLE = ["scheduled", "checked_in", "attended"] as const;

function serviceOf(typeService: ServiceKey | null, rateService: ServiceKey): ServiceKey {
  if (!typeService) return "none";
  return rateService === "aide" ? "aide" : typeService;
}

/** The branch's low-credit reminder amount. */
export async function lowCreditThreshold(db: DbExecutor, branchId: string) {
  const [row] = await db
    .select({ value: branches.lowCreditThresholdCentavos })
    .from(branches)
    .where(eq(branches.id, branchId));
  return row?.value ?? 100_000;
}

export async function setLowCreditThreshold(
  db: DbExecutor,
  actor: Actor,
  input: { branchId: string; value: unknown },
) {
  assertCan(actor, "settings:manage", { branchId: input.branchId });
  const value = lowCreditThresholdInput.parse(input.value);
  const before = await lowCreditThreshold(db, input.branchId);
  await db
    .update(branches)
    .set({ lowCreditThresholdCentavos: value })
    .where(eq(branches.id, input.branchId));
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "settings.low_credit_threshold",
    entity: "branch",
    entityId: input.branchId,
    before: { value: before },
    after: { value },
    ip: actor.ip,
  });
}

/** Credit balances for many patients at once (sum of the ledger). */
async function balancesFor(db: DbExecutor, patientIds: string[]) {
  if (!patientIds.length) return new Map<string, number>();
  const rows = await db
    .select({
      patientId: creditLedger.patientId,
      total: sql<string>`sum(${creditLedger.amountCentavos})`,
    })
    .from(creditLedger)
    .where(inArray(creditLedger.patientId, patientIds))
    .groupBy(creditLedger.patientId);
  return new Map(rows.map((r) => [r.patientId, Number(r.total)]));
}

export function paymentMethodLabel(p: {
  method: keyof typeof PAYMENT_METHOD_LABELS | null;
  creditAppliedCentavos: number;
}) {
  if (!p.method) return "Credit";
  return p.creditAppliedCentavos > 0
    ? `Credit + ${PAYMENT_METHOD_LABELS[p.method]}`
    : PAYMENT_METHOD_LABELS[p.method];
}

/** The billing screen for one day: sessions that started or were paid, and the four totals. */
export async function getBillingDay(
  db: DbExecutor,
  actor: Actor,
  input: { branchId: string; date: string },
) {
  assertCan(actor, "billing:read", { branchId: input.branchId });
  const from = fromManilaLocal(input.date, "00:00");
  const to = fromManilaLocal(format(addDays(parseISO(input.date), 1), "yyyy-MM-dd"), "00:00");
  const rows = await db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      status: appointments.status,
      feeCentavos: appointments.feeCentavos,
      patientId: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      typeName: sessionTypes.name,
      typeService: sessionTypes.service,
      rateService: rateClasses.service,
      staffName: staff.shortName,
      payment: payments,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(sessionTypes, eq(appointments.sessionTypeId, sessionTypes.id))
    .innerJoin(staff, eq(appointments.staffId, staff.id))
    .innerJoin(rateClasses, eq(staff.rateClassId, rateClasses.id))
    .leftJoin(payments, eq(payments.appointmentId, appointments.id))
    .where(
      and(
        eq(appointments.branchId, input.branchId),
        gte(appointments.startsAt, from),
        lt(appointments.startsAt, to),
        // The desk collects after each session: checked in, attended, or already paid.
        or(
          inArray(appointments.status, ["checked_in", "attended"]),
          sql`${payments.id} is not null`,
        ),
      ),
    )
    .orderBy(asc(appointments.startsAt), asc(staff.sortOrder));

  const branchPatients = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.branchId, input.branchId), isNull(patients.deletedAt)));
  const ids = branchPatients.map((p) => p.id);
  const [balances, owed] = await Promise.all([balancesFor(db, ids), owedByPatient(db, ids, from)]);
  const withCredit = [...balances.values()].filter((b) => b > 0);
  const owedValues = [...owed.values()].filter((v) => v > 0);

  const items = rows.map((r) => ({
    id: r.id,
    startsAt: r.startsAt.toISOString(),
    status: r.status,
    feeCentavos: r.feeCentavos,
    patientId: r.patientId,
    patientName: `${r.firstName} ${r.lastName}`,
    sessionTypeName: r.typeName,
    service: serviceOf(r.typeService, r.rateService),
    staffName: r.staffName,
    paid: Boolean(r.payment),
    methodLabel: r.payment ? paymentMethodLabel(r.payment) : null,
    receiptNo: r.payment?.receiptNo ?? null,
    creditCentavos: balances.get(r.patientId) ?? 0,
  }));
  return {
    items,
    totals: {
      collectedCentavos: items.filter((i) => i.paid).reduce((sum, i) => sum + i.feeCentavos, 0),
      pendingCentavos: items.filter((i) => !i.paid).reduce((sum, i) => sum + i.feeCentavos, 0),
      paidCount: items.filter((i) => i.paid).length,
      outstandingCentavos: owedValues.reduce((sum, v) => sum + v, 0),
      owingPatients: owedValues.length,
      creditOnFileCentavos: withCredit.reduce((sum, v) => sum + v, 0),
      patientsWithCredit: withCredit.length,
    },
  };
}
export type BillingDay = Awaited<ReturnType<typeof getBillingDay>>;

/** What the collect payment dialog needs for one session. */
export async function getPaymentContext(db: DbExecutor, actor: Actor, appointmentId: string) {
  const [row] = await db
    .select({
      appointment: appointments,
      firstName: patients.firstName,
      lastName: patients.lastName,
      typeName: sessionTypes.name,
      typeService: sessionTypes.service,
      rateService: rateClasses.service,
      staffName: staff.shortName,
      paymentId: payments.id,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(sessionTypes, eq(appointments.sessionTypeId, sessionTypes.id))
    .innerJoin(staff, eq(appointments.staffId, staff.id))
    .innerJoin(rateClasses, eq(staff.rateClassId, rateClasses.id))
    .leftJoin(payments, eq(payments.appointmentId, appointments.id))
    .where(eq(appointments.id, appointmentId));
  if (!row) throw new NotFoundError();
  assertCan(actor, "payment:collect", { branchId: row.appointment.branchId });
  return {
    appointmentId: row.appointment.id,
    startsAt: row.appointment.startsAt.toISOString(),
    feeCentavos: row.appointment.feeCentavos,
    patientId: row.appointment.patientId,
    patientName: `${row.firstName} ${row.lastName}`,
    sessionTypeName: row.typeName,
    service: serviceOf(row.typeService, row.rateService),
    staffName: row.staffName,
    alreadyPaid: Boolean(row.paymentId),
    creditBalanceCentavos: await creditBalance(db, row.appointment.patientId),
  };
}
export type PaymentContext = Awaited<ReturnType<typeof getPaymentContext>>;

/**
 * Takes payment for one session in a single transaction. The appointment and
 * the patient rows are locked, so two desks clicking "Collect" at once cannot
 * both charge it, and credit cannot be spent twice. The unique constraint on
 * payments.appointment_id is the final guard.
 */
export async function collectPayment(db: DbExecutor, actor: Actor, raw: unknown) {
  const input = collectPaymentInput.parse(raw);
  const [appointment] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, input.appointmentId))
    .for("update");
  if (!appointment) throw new NotFoundError();
  assertCan(actor, "payment:collect", { branchId: appointment.branchId });
  if (!(PAYABLE as readonly string[]).includes(appointment.status)) {
    throw new ValidationError(
      "This session was cancelled, moved or missed, so there is nothing to collect.",
    );
  }
  const [existing] = await db
    .select({ receiptNo: payments.receiptNo })
    .from(payments)
    .where(eq(payments.appointmentId, appointment.id));
  if (existing)
    throw new ValidationError(`This session is already paid (receipt ${existing.receiptNo}).`);

  // Lock the patient so concurrent payments cannot both spend the same credit.
  await db
    .select({ id: patients.id })
    .from(patients)
    .where(eq(patients.id, appointment.patientId))
    .for("update");
  const balance = await creditBalance(db, appointment.patientId);
  const quote = quotePayment({
    ...input,
    dueCentavos: appointment.feeCentavos,
    creditBalanceCentavos: balance,
  });
  if (!quote.canConfirm) {
    if (quote.shortByCentavos !== null)
      throw new ValidationError("The cash received is less than what's due.");
    if (quote.needsMethod && input.method !== "cash")
      throw new ValidationError("Enter the reference number for this payment.");
    throw new ValidationError("Enter the cash received or choose another method.");
  }

  const receiptNo = await takeReceiptNumber(db, appointment.branchId);
  const [payment] = await db
    .insert(payments)
    .values({
      appointmentId: appointment.id,
      patientId: appointment.patientId,
      branchId: appointment.branchId,
      amountCentavos: appointment.feeCentavos,
      creditAppliedCentavos: quote.creditAppliedCentavos,
      method: quote.needsMethod ? input.method : null,
      referenceNo: quote.needsMethod && input.method !== "cash" ? input.referenceNo : null,
      cashReceivedCentavos:
        quote.needsMethod && input.method === "cash" ? input.cashReceivedCentavos : null,
      receiptNo,
      receivedByUserId: actor.userId,
      createdAt: clinicNow(),
    })
    .returning();

  if (quote.creditAppliedCentavos > 0) {
    const [details] = await db
      .select({ typeName: sessionTypes.name, staffName: staff.shortName })
      .from(sessionTypes)
      .innerJoin(staff, eq(staff.id, appointment.staffId))
      .where(eq(sessionTypes.id, appointment.sessionTypeId));
    await db.insert(creditLedger).values({
      patientId: appointment.patientId,
      type: "deduction",
      amountCentavos: -quote.creditAppliedCentavos,
      description: `${details?.typeName ?? "Session"}, ${details?.staffName ?? ""}`,
      receiptNo,
      relatedPaymentId: payment!.id,
      createdByUserId: actor.userId,
      createdAt: clinicNow(),
    });
  }
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "payment.collect",
    entity: "payment",
    entityId: payment!.id,
    after: {
      appointmentId: appointment.id,
      amount: appointment.feeCentavos,
      credit: quote.creditAppliedCentavos,
      method: payment!.method,
      receiptNo,
    },
    ip: actor.ip,
  });
  const balanceAfter = balance - quote.creditAppliedCentavos;
  const threshold = await lowCreditThreshold(db, appointment.branchId);
  return {
    receiptNo,
    methodLabel: quote.methodLabel,
    changeCentavos: quote.changeCentavos,
    creditBalanceAfterCentavos: balanceAfter,
    lowCredit: quote.creditAppliedCentavos > 0 && balanceAfter < threshold,
  };
}

/** Records an advance payment: non-refundable credit on the patient's ledger. */
export async function recordTopUp(db: DbExecutor, actor: Actor, raw: unknown) {
  const input = topUpInput.parse(raw);
  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, input.patientId))
    .for("update");
  if (!patient || patient.deletedAt) throw new NotFoundError();
  assertCan(actor, "credit:top-up", { branchId: patient.branchId });
  const receiptNo = input.receiptNo || (await takeReceiptNumber(db, patient.branchId));
  const [entry] = await db
    .insert(creditLedger)
    .values({
      patientId: patient.id,
      type: "top_up",
      amountCentavos: input.amountCentavos,
      description: "Advance payment",
      method: input.method,
      referenceNo: input.referenceNo || null,
      receiptNo,
      notes: input.notes || null,
      createdByUserId: actor.userId,
      createdAt: clinicNow(),
    })
    .returning();
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "credit.top_up",
    entity: "credit_ledger",
    entityId: entry!.id,
    after: { patientId: patient.id, amount: input.amountCentavos, method: input.method, receiptNo },
    ip: actor.ip,
  });
  return {
    receiptNo,
    balanceCentavos: await creditBalance(db, patient.id),
    patientName: `${patient.firstName} ${patient.lastName}`,
  };
}

/** Patients whose credit is above zero but under the reminder threshold. */
export async function lowCreditPatients(db: DbExecutor, branchId: string) {
  const threshold = await lowCreditThreshold(db, branchId);
  const rows = await db
    .select({
      patientId: creditLedger.patientId,
      firstName: patients.firstName,
      lastName: patients.lastName,
      total: sql<string>`sum(${creditLedger.amountCentavos})`,
    })
    .from(creditLedger)
    .innerJoin(patients, eq(creditLedger.patientId, patients.id))
    .where(and(eq(patients.branchId, branchId), isNull(patients.deletedAt)))
    .groupBy(creditLedger.patientId, patients.firstName, patients.lastName)
    .having(
      and(
        gt(sql`sum(${creditLedger.amountCentavos})`, 0),
        lt(sql`sum(${creditLedger.amountCentavos})`, threshold),
      ),
    );
  return {
    threshold,
    patients: rows.map((r) => ({
      patientId: r.patientId,
      name: `${r.firstName} ${r.lastName}`,
      balanceCentavos: Number(r.total),
    })),
  };
}
