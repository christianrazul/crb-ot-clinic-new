import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@/server/auth/permissions";
import { debtBalance } from "@/server/db/queries/billing";
import { auditLog, debtLedger, payments } from "@/server/db/schema";
import {
  collectPayment,
  getBillingDay,
  recordDebtPayment,
  voidDebtEntry,
  voidPayment,
} from "@/server/services/payments";

import { ACTORS } from "../support/actors";
import { failureCode, inRollback, PG } from "./support";

const TAN = "apt_20260822_10_tan"; // checked in, unpaid, ₱700, pat_06 has no credit
const TAN_PATIENT = "pat_06";

const shortCash = (received: number, markAsDebt = true) => ({
  appointmentId: TAN,
  useCredit: false,
  creditRequestedCentavos: null,
  method: "cash" as const,
  cashReceivedCentavos: received,
  referenceNo: "",
  markAsDebt,
});

const debtPayment = (amountCentavos: number) => ({
  patientId: TAN_PATIENT,
  amountCentavos,
  method: "cash" as const,
});

describe("marking a shortfall as debt (D-129)", () => {
  it("records the cash paid and puts the rest on the patient's tab", () =>
    inRollback(async (tx) => {
      const before = await getBillingDay(tx, ACTORS.desk, {
        branchId: "br_bangkal",
        date: "2026-08-22",
      });
      const result = await collectPayment(tx, ACTORS.desk, shortCash(30_000));
      expect(result).toMatchObject({
        debtCentavos: 40_000,
        paidNowCentavos: 30_000,
        debtBalanceAfterCentavos: 40_000,
        methodLabel: "Cash + Debt",
      });
      const [payment] = await tx.select().from(payments).where(eq(payments.appointmentId, TAN));
      expect(payment).toMatchObject({
        amountCentavos: 70_000,
        debtCentavos: 40_000,
        method: "cash",
        cashReceivedCentavos: 30_000,
      });
      const [charge] = await tx
        .select()
        .from(debtLedger)
        .where(eq(debtLedger.relatedPaymentId, payment!.id));
      expect(charge).toMatchObject({ type: "charge", amountCentavos: 40_000 });
      expect(await debtBalance(tx, TAN_PATIENT)).toBe(40_000);

      // The day shows the session as paid with debt, and counts the debt as outstanding.
      const day = await getBillingDay(tx, ACTORS.desk, {
        branchId: "br_bangkal",
        date: "2026-08-22",
      });
      expect(day.items.find((i) => i.id === TAN)).toMatchObject({
        paid: true,
        debtCentavos: 40_000,
        methodLabel: "Cash + Debt",
      });
      expect(day.totals.outstandingCentavos).toBe(before.totals.outstandingCentavos + 40_000);
      expect(day.totals.collectedCentavos).toBe(before.totals.collectedCentavos + 30_000);
    }));

  it("puts the whole fee on the tab when nothing is paid, with no method", () =>
    inRollback(async (tx) => {
      await collectPayment(tx, ACTORS.desk, shortCash(0));
      const [payment] = await tx.select().from(payments).where(eq(payments.appointmentId, TAN));
      expect(payment).toMatchObject({ debtCentavos: 70_000, method: null });
      expect(await debtBalance(tx, TAN_PATIENT)).toBe(70_000);
    }));

  it("takes a short GCash transfer with the rest as debt", () =>
    inRollback(async (tx) => {
      const gcash = { ...shortCash(30_000), method: "gcash" as const, referenceNo: "0029 8841" };
      await expect(
        collectPayment(tx, ACTORS.desk, { ...gcash, markAsDebt: false }),
      ).rejects.toThrow(/less than what's due/);
      await expect(
        collectPayment(tx, ACTORS.desk, {
          ...gcash,
          cashReceivedCentavos: 80_000,
          markAsDebt: false,
        }),
      ).rejects.toThrow(/more than what's due/);
      const result = await collectPayment(tx, ACTORS.desk, gcash);
      expect(result).toMatchObject({ debtCentavos: 40_000, methodLabel: "GCash + Debt" });
      const [payment] = await tx.select().from(payments).where(eq(payments.appointmentId, TAN));
      expect(payment).toMatchObject({
        method: "gcash",
        referenceNo: "0029 8841",
        cashReceivedCentavos: null,
        debtCentavos: 40_000,
      });
      expect(await debtBalance(tx, TAN_PATIENT)).toBe(40_000);
    }));

  it("still refuses short cash unless it is marked as debt", () =>
    inRollback(async (tx) => {
      await expect(collectPayment(tx, ACTORS.desk, shortCash(30_000, false))).rejects.toThrow(
        /less than what's due/,
      );
    }));

  it("pays debt down with a receipt, never past zero", () =>
    inRollback(async (tx) => {
      await collectPayment(tx, ACTORS.desk, shortCash(30_000));
      const part = await recordDebtPayment(tx, ACTORS.desk, debtPayment(10_000));
      expect(part.debtBalanceCentavos).toBe(30_000);
      expect(part.receiptNo).toBe("CRB-1101");
      await expect(recordDebtPayment(tx, ACTORS.desk, debtPayment(50_000))).rejects.toThrow(
        /more than .* owes/,
      );
      await expect(
        recordDebtPayment(tx, ACTORS.therapist, debtPayment(10_000)),
      ).rejects.toBeInstanceOf(ForbiddenError);
      const rest = await recordDebtPayment(tx, ACTORS.desk, debtPayment(30_000));
      expect(rest.debtBalanceCentavos).toBe(0);
      await expect(recordDebtPayment(tx, ACTORS.desk, debtPayment(100))).rejects.toThrow(/no debt/);
      const audits = await tx.select().from(auditLog).where(eq(auditLog.action, "debt.settle"));
      expect(audits).toHaveLength(2);
    }));

  it("voids a debt payment back onto the tab, but not a charge", () =>
    inRollback(async (tx) => {
      await collectPayment(tx, ACTORS.desk, shortCash(30_000));
      await recordDebtPayment(tx, ACTORS.desk, debtPayment(10_000));
      const rows = await tx.select().from(debtLedger).where(eq(debtLedger.patientId, TAN_PATIENT));
      const charge = rows.find((r) => r.type === "charge")!;
      const settlement = rows.find((r) => r.type === "settlement")!;
      await expect(
        voidDebtEntry(tx, ACTORS.desk, { entryId: charge.id, reason: "Mistake" }),
      ).rejects.toThrow(/session's payment/);
      await voidDebtEntry(tx, ACTORS.desk, { entryId: settlement.id, reason: "Typed twice" });
      expect(await debtBalance(tx, TAN_PATIENT)).toBe(40_000);
    }));

  it("voiding the session payment clears its debt, unless some was paid off", () =>
    inRollback(async (tx) => {
      await collectPayment(tx, ACTORS.desk, shortCash(30_000));
      const [payment] = await tx.select().from(payments).where(eq(payments.appointmentId, TAN));
      await recordDebtPayment(tx, ACTORS.desk, debtPayment(10_000));
      await expect(
        voidPayment(tx, ACTORS.desk, { paymentId: payment!.id, reason: "Wrong session" }),
      ).rejects.toThrow(/already paid off/);
      const settlement = (
        await tx.select().from(debtLedger).where(eq(debtLedger.type, "settlement"))
      )[0]!;
      await voidDebtEntry(tx, ACTORS.desk, { entryId: settlement.id, reason: "Undo" });
      await voidPayment(tx, ACTORS.desk, { paymentId: payment!.id, reason: "Wrong session" });
      expect(await debtBalance(tx, TAN_PATIENT)).toBe(0);
      // The session can be collected again.
      await collectPayment(tx, ACTORS.desk, shortCash(70_000, false));
    }));

  it("keeps debt rows append-only", () =>
    inRollback(async (tx) => {
      await collectPayment(tx, ACTORS.desk, shortCash(30_000));
      expect(await failureCode(tx, (s) => s.delete(debtLedger))).toBe(PG.restrictViolation);
    }));
});
