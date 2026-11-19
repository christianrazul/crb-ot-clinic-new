import { eq, inArray, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@/server/auth/permissions";
import type { DbExecutor } from "@/server/db/client";
import { auditLog, creditLedger, payments, receiptCounters } from "@/server/db/schema";
import { getNotifications } from "@/server/services/notifications";
import {
  collectPayment,
  correctPayment,
  getBillingDay,
  lowCreditPatients,
  recordTopUp,
  setLowCreditThreshold,
} from "@/server/services/payments";

import { ACTORS } from "../support/actors";
import { inRollback, testDb } from "./support";

const RAMOS = "apt_20260822_09_ramos"; // attended, unpaid, pat_03 has ₱4,900 credit
const TAN = "apt_20260822_10_tan"; // checked in, unpaid, pat_06 has no credit

const cash = (appointmentId: string, received: number | null) => ({
  appointmentId,
  useCredit: false,
  creditRequestedCentavos: null,
  method: "cash" as const,
  cashReceivedCentavos: received,
  referenceNo: "",
});

const balanceOf = async (tx: DbExecutor, patientId: string) => {
  const [row] = await tx
    .select({ total: sql<string>`coalesce(sum(${creditLedger.amountCentavos}), 0)` })
    .from(creditLedger)
    .where(eq(creditLedger.patientId, patientId));
  return Number(row!.total);
};

describe("collecting payment", () => {
  it("takes cash, returns change, and numbers receipts without gaps", () =>
    inRollback(async (tx) => {
      const first = await collectPayment(tx, ACTORS.desk, cash(TAN, 100_000));
      const second = await collectPayment(tx, ACTORS.desk, cash(RAMOS, 70_000));
      expect(first).toMatchObject({ receiptNo: "CRB-1100", changeCentavos: 30_000 });
      expect(second.receiptNo).toBe("CRB-1101");
      const [counter] = await tx
        .select()
        .from(receiptCounters)
        .where(eq(receiptCounters.branchId, "br_bangkal"));
      expect(counter!.nextNumber).toBe(1102);
      const audits = await tx.select().from(auditLog).where(eq(auditLog.action, "payment.collect"));
      expect(audits).toHaveLength(2);
    }));

  it("spends credit with a ledger deduction linked to the payment", () =>
    inRollback(async (tx) => {
      const before = await balanceOf(tx, "pat_03");
      const result = await collectPayment(tx, ACTORS.desk, {
        ...cash(RAMOS, null),
        useCredit: true,
      });
      expect(result.creditBalanceAfterCentavos).toBe(before - 70_000);
      const [payment] = await tx.select().from(payments).where(eq(payments.appointmentId, RAMOS));
      expect(payment).toMatchObject({ creditAppliedCentavos: 70_000, method: null });
      const [deduction] = await tx
        .select()
        .from(creditLedger)
        .where(eq(creditLedger.relatedPaymentId, payment!.id));
      expect(deduction).toMatchObject({ type: "deduction", amountCentavos: -70_000 });
      // The balance is always the sum of the ledger rows.
      expect(await balanceOf(tx, "pat_03")).toBe(before - 70_000);
    }));

  it("refuses short cash, missing references, repeat payments and therapists", () =>
    inRollback(async (tx) => {
      await expect(collectPayment(tx, ACTORS.desk, cash(TAN, 50_000))).rejects.toThrow(
        /less than what's due/,
      );
      await expect(
        collectPayment(tx, ACTORS.desk, { ...cash(TAN, null), method: "gcash" }),
      ).rejects.toThrow(/reference number/);
      await expect(collectPayment(tx, ACTORS.therapist, cash(TAN, 70_000))).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      await collectPayment(tx, ACTORS.desk, cash(TAN, 70_000));
      await expect(collectPayment(tx, ACTORS.desk, cash(TAN, 70_000))).rejects.toThrow(
        /already paid \(receipt CRB-1100\)/,
      );
    }));

  it("charges once when two desks collect the same session at the same time", async () => {
    const db = testDb();
    const attempt = () =>
      db.transaction((tx) => collectPayment(tx, ACTORS.desk, cash(TAN, 70_000)));
    try {
      const results = await Promise.allSettled([attempt(), attempt()]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
      const rows = await db.select().from(payments).where(eq(payments.appointmentId, TAN));
      expect(rows).toHaveLength(1);
    } finally {
      // Payments are append-only; bypass the triggers to restore the seed for later files.
      await db.transaction(async (tx) => {
        await tx.execute(sql`set local session_replication_role = replica`);
        const paid = await tx
          .select({ id: payments.id })
          .from(payments)
          .where(eq(payments.appointmentId, TAN));
        if (paid.length)
          await tx.delete(auditLog).where(
            inArray(
              auditLog.entityId,
              paid.map((p) => p.id),
            ),
          );
        await tx.delete(payments).where(eq(payments.appointmentId, TAN));
        await tx
          .update(receiptCounters)
          .set({ nextNumber: 1100 })
          .where(eq(receiptCounters.branchId, "br_bangkal"));
      });
    }
  });
});

describe("backlogged payments", () => {
  const dayOf = (instant: Date) => instant.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  it("dates a payment on the day it was received, not the day it was entered", () =>
    inRollback(async (tx) => {
      await collectPayment(tx, ACTORS.desk, { ...cash(TAN, 70_000), receivedOn: "2026-08-14" });
      const [row] = await tx.select().from(payments).where(eq(payments.appointmentId, TAN));
      expect(dayOf(row!.createdAt)).toBe("2026-08-14");
      // The audit log still says when it was actually entered.
      const [audit] = await tx
        .select()
        .from(auditLog)
        .where(eq(auditLog.action, "payment.collect"));
      expect(dayOf(audit!.createdAt)).not.toBe("2026-08-14");
    }));

  it("dates the credit it spends and an advance the same way", () =>
    inRollback(async (tx) => {
      await collectPayment(tx, ACTORS.desk, {
        appointmentId: RAMOS,
        useCredit: true,
        creditRequestedCentavos: null,
        method: "cash",
        cashReceivedCentavos: null,
        referenceNo: "",
        receivedOn: "2026-08-10",
      });
      const spent = await tx.select().from(creditLedger).where(eq(creditLedger.type, "deduction"));
      expect(spent.some((e) => dayOf(e.createdAt) === "2026-08-10")).toBe(true);
      await recordTopUp(tx, ACTORS.desk, {
        patientId: "pat_06",
        amountCentavos: 100_000,
        method: "cash",
        receivedOn: "2026-08-05",
      });
      const [topUp] = await tx
        .select()
        .from(creditLedger)
        .where(eq(creditLedger.patientId, "pat_06"));
      expect(dayOf(topUp!.createdAt)).toBe("2026-08-05");
    }));

  it("refuses a future date", () =>
    inRollback(async (tx) => {
      await expect(
        collectPayment(tx, ACTORS.desk, { ...cash(TAN, 70_000), receivedOn: "2026-12-01" }),
      ).rejects.toThrow(/can't be in the future/);
    }));

  it("keeps the original day when a payment is corrected", () =>
    inRollback(async (tx) => {
      await collectPayment(tx, ACTORS.desk, { ...cash(TAN, 70_000), receivedOn: "2026-08-14" });
      const [old] = await tx.select().from(payments).where(eq(payments.appointmentId, TAN));
      await correctPayment(tx, ACTORS.desk, {
        paymentId: old!.id,
        reason: "Wrong amount typed",
        payment: cash(TAN, 80_000),
      });
      const live = await tx.select().from(payments).where(eq(payments.appointmentId, TAN));
      const fresh = live.find((p) => !p.voidedAt);
      expect(dayOf(fresh!.createdAt)).toBe("2026-08-14");
    }));
});

describe("advance payments", () => {
  it("records a top-up with the next receipt number and keeps typed ones", () =>
    inRollback(async (tx) => {
      const auto = await recordTopUp(tx, ACTORS.desk, {
        patientId: "pat_06",
        amountCentavos: 500_000,
        method: "cash",
      });
      expect(auto).toMatchObject({ receiptNo: "CRB-1100", balanceCentavos: 500_000 });
      const typed = await recordTopUp(tx, ACTORS.desk, {
        patientId: "pat_06",
        amountCentavos: 100_000,
        method: "gcash",
        referenceNo: "0029 8841",
        receiptNo: "OR-77",
      });
      expect(typed).toMatchObject({ receiptNo: "OR-77", balanceCentavos: 600_000 });
    }));

  it("needs a reference for non-cash top-ups and refuses therapists", () =>
    inRollback(async (tx) => {
      await expect(
        recordTopUp(tx, ACTORS.desk, {
          patientId: "pat_06",
          amountCentavos: 100_000,
          method: "maya",
        }),
      ).rejects.toThrow(/reference number/);
      await expect(
        recordTopUp(tx, ACTORS.therapist, {
          patientId: "pat_06",
          amountCentavos: 100_000,
          method: "cash",
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }));
});

describe("billing day and low credit", () => {
  it("lists payable sessions with totals for the day", async () => {
    const day = await getBillingDay(testDb(), ACTORS.desk, {
      branchId: "br_bangkal",
      date: "2026-08-22",
    });
    const ids = day.items.map((i) => i.id);
    expect(ids).toEqual(expect.arrayContaining([RAMOS, TAN]));
    expect(day.totals.pendingCentavos).toBe(
      day.items.filter((i) => !i.paid).reduce((sum, i) => sum + i.feeCentavos, 0),
    );
    await expect(
      getBillingDay(testDb(), ACTORS.therapist, { branchId: "br_bangkal", date: "2026-08-22" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("flags patients under the threshold, and only the owner changes it", () =>
    inRollback(async (tx) => {
      const { patients: low } = await lowCreditPatients(tx, "br_bangkal");
      expect(low.map((p) => p.patientId)).toEqual(["pat_05"]);
      const notes = await getNotifications(tx, ACTORS.desk, "br_bangkal");
      expect(notes.some((n) => n.kind === "low_credit")).toBe(true);

      await expect(
        setLowCreditThreshold(tx, ACTORS.desk, { branchId: "br_bangkal", value: 500_000 }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await setLowCreditThreshold(tx, ACTORS.owner, { branchId: "br_bangkal", value: 500_000 });
      const raised = await lowCreditPatients(tx, "br_bangkal");
      expect(raised.patients.map((p) => p.patientId).sort()).toEqual([
        "pat_01",
        "pat_03",
        "pat_05",
      ]);
    }));
});
