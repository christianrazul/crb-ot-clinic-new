import { and, eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@/server/auth/permissions";
import { creditBalance, paymentForAppointment } from "@/server/db/queries/billing";
import { auditLog, creditLedger, patientBackupStaff, patients, payments } from "@/server/db/schema";
import {
  adjustCredit,
  collectPayment,
  correctPayment,
  correctTopUp,
  getBillingDay,
  recordTopUp,
  voidCreditEntry,
  voidPayment,
} from "@/server/services/payments";
import {
  createPatient,
  listPatientsFor,
  setPatientStatus,
  updatePatient,
} from "@/server/services/patients";

import { ACTORS } from "../support/actors";
import { failureCode, inRollback, PG } from "./support";

const RAMOS = "apt_20260822_09_ramos"; // attended, unpaid; pat_03 has ₱4,900 credit
const byCredit = {
  appointmentId: RAMOS,
  useCredit: true,
  creditRequestedCentavos: null,
  method: "cash" as const,
  cashReceivedCentavos: null,
  referenceNo: "",
};

describe("voiding and correcting payments", () => {
  it("a voided payment leaves the session unpaid and gives the credit back", () =>
    inRollback(async (tx) => {
      const before = await creditBalance(tx, "pat_03");
      const { receiptNo } = await collectPayment(tx, ACTORS.desk, byCredit);
      expect(await creditBalance(tx, "pat_03")).toBe(before - 70_000);
      const paid = (await paymentForAppointment(tx, RAMOS))!;

      await voidPayment(tx, ACTORS.desk, { paymentId: paid.id, reason: "Wrong patient" });
      expect(await paymentForAppointment(tx, RAMOS)).toBeNull();
      expect(await creditBalance(tx, "pat_03")).toBe(before);
      const day = await getBillingDay(tx, ACTORS.desk, {
        branchId: "br_bangkal",
        date: "2026-08-22",
      });
      expect(day.items.find((i) => i.id === RAMOS)).toMatchObject({ paid: false });
      // The voided receipt stays on record.
      const [kept] = await tx.select().from(payments).where(eq(payments.id, paid.id));
      expect(kept).toMatchObject({
        receiptNo,
        voidReason: "Wrong patient",
        voidedByUserId: "usr_desk",
      });
      const [entry] = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.action, "payment.void"), eq(auditLog.entityId, paid.id)));
      expect(entry).toBeTruthy();

      // It can be collected again.
      await collectPayment(tx, ACTORS.desk, {
        ...byCredit,
        useCredit: false,
        cashReceivedCentavos: 70_000,
      });
      expect(await paymentForAppointment(tx, RAMOS)).toMatchObject({ method: "cash" });

      await expect(
        voidPayment(tx, ACTORS.desk, { paymentId: paid.id, reason: "Again" }),
      ).rejects.toThrow(/already voided/);
      await expect(
        voidPayment(tx, ACTORS.therapist, { paymentId: paid.id, reason: "No" }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        voidPayment(tx, ACTORS.desk, { paymentId: "pay_0001", reason: "" }),
      ).rejects.toThrow(/why/);
    }));

  it("editing a payment voids it and records the corrected one with a new receipt", () =>
    inRollback(async (tx) => {
      const result = await correctPayment(tx, ACTORS.desk, {
        paymentId: "pay_0001",
        reason: "Paid by GCash, not cash",
        payment: {
          useCredit: false,
          creditRequestedCentavos: null,
          method: "gcash",
          cashReceivedCentavos: null,
          referenceNo: "0029 1111",
        },
      });
      expect(result.receiptNo).not.toBe("CRB-1097");
      const live = (await paymentForAppointment(tx, "apt_20260822_09_delarosa"))!;
      expect(live).toMatchObject({ method: "gcash", replacesPaymentId: "pay_0001" });
      const [old] = await tx.select().from(payments).where(eq(payments.id, "pay_0001"));
      expect(old!.voidedAt).not.toBeNull();
    }));

  it("the database refuses edits, deletes and voids without a reason", () =>
    inRollback(async (tx) => {
      expect(
        await failureCode(tx, (t) =>
          t.update(payments).set({ amountCentavos: 1 }).where(eq(payments.id, "pay_0001")),
        ),
      ).toBe(PG.restrictViolation);
      expect(
        await failureCode(tx, (t) =>
          t
            .update(payments)
            .set({ voidedAt: new Date(), voidedByUserId: "usr_desk", voidReason: " " })
            .where(eq(payments.id, "pay_0001")),
        ),
      ).toBe(PG.restrictViolation);
      expect(
        await failureCode(tx, (t) =>
          t
            .update(payments)
            .set({
              voidedAt: new Date(),
              voidedByUserId: "usr_desk",
              voidReason: "ok",
              amountCentavos: 1,
            })
            .where(eq(payments.id, "pay_0001")),
        ),
      ).toBe(PG.restrictViolation);
      expect(
        await failureCode(tx, (t) =>
          t.execute(sql`delete from credit_ledger where patient_id = 'pat_01'`),
        ),
      ).toBe(PG.restrictViolation);
    }));
});

describe("correcting advance credit", () => {
  it("voids an unspent advance, but not one that was already spent", () =>
    inRollback(async (tx) => {
      await recordTopUp(tx, ACTORS.desk, {
        patientId: "pat_06",
        amountCentavos: 500_000,
        method: "cash",
      });
      const [topUp] = await tx
        .select()
        .from(creditLedger)
        .where(and(eq(creditLedger.patientId, "pat_06"), eq(creditLedger.type, "top_up")));
      await voidCreditEntry(tx, ACTORS.desk, { entryId: topUp!.id, reason: "Recorded twice" });
      expect(await creditBalance(tx, "pat_06")).toBe(0);

      // Liam's ₱7,000 advance has ₱2,800 spent on sessions.
      const [liam] = await tx
        .select()
        .from(creditLedger)
        .where(and(eq(creditLedger.patientId, "pat_01"), eq(creditLedger.type, "top_up")));
      await expect(
        voidCreditEntry(tx, ACTORS.desk, { entryId: liam!.id, reason: "Test" }),
      ).rejects.toThrow(/already spent/);
      const [spent] = await tx
        .select()
        .from(creditLedger)
        .where(and(eq(creditLedger.patientId, "pat_01"), eq(creditLedger.type, "deduction")));
      await expect(
        voidCreditEntry(tx, ACTORS.desk, { entryId: spent!.id, reason: "Test" }),
      ).rejects.toThrow(/that session's payment/);
    }));

  it("edits an advance's amount, and adjusts a balance by hand", () =>
    inRollback(async (tx) => {
      await recordTopUp(tx, ACTORS.desk, {
        patientId: "pat_06",
        amountCentavos: 350_000,
        method: "cash",
      });
      const [topUp] = await tx
        .select()
        .from(creditLedger)
        .where(and(eq(creditLedger.patientId, "pat_06"), eq(creditLedger.type, "top_up")));
      const corrected = await correctTopUp(tx, ACTORS.desk, {
        entryId: topUp!.id,
        reason: "Typed ₱3,500, received ₱3,000",
        topUp: { amountCentavos: 300_000, method: "gcash", referenceNo: "REF-1" },
      });
      expect(corrected.balanceCentavos).toBe(300_000);
      const rows = await tx.select().from(creditLedger).where(eq(creditLedger.patientId, "pat_06"));
      expect(rows.find((r) => r.replacesEntryId === topUp!.id)).toMatchObject({ method: "gcash" });

      expect(
        await adjustCredit(tx, ACTORS.owner, {
          patientId: "pat_06",
          amountCentavos: -50_000,
          reason: "Counted wrong",
        }),
      ).toEqual({ balanceCentavos: 250_000 });
      await expect(
        adjustCredit(tx, ACTORS.owner, {
          patientId: "pat_06",
          amountCentavos: -900_000,
          reason: "Too much",
        }),
      ).rejects.toThrow(/below ₱0/);
      await expect(
        adjustCredit(tx, ACTORS.therapist, {
          patientId: "pat_06",
          amountCentavos: 100,
          reason: "x y z",
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }));
});

describe("therapists adding patients", () => {
  const newPatient = {
    firstName: "Mika",
    lastName: "Reyes",
    service: "ot",
    enrolledOn: "2026-08-20",
    primaryStaffId: "stf_tan", // ignored when a therapist adds a patient
    backupStaffIds: ["stf_ramos"],
  };

  it("a therapist's new patient is assigned to them and shows in their list", () =>
    inRollback(async (tx) => {
      const created = await createPatient(tx, ACTORS.therapist, {
        branchId: "br_bangkal",
        values: newPatient,
      });
      expect(created.primaryStaffId).toBe("stf_delarosa");
      const mine = await listPatientsFor(tx, ACTORS.therapist, {
        branchId: "br_bangkal",
        query: "Mika",
      });
      expect(mine.rows.map((p) => p.id)).toContain(created.id);
    }));

  it("they edit details and therapists of their own patients only, and can't deactivate", () =>
    inRollback(async (tx) => {
      await updatePatient(tx, ACTORS.therapist, {
        patientId: "pat_01",
        values: { ...newPatient, firstName: "Liam", lastName: "Santos", diagnosis: "Updated" },
      });
      const [after] = await tx.select().from(patients).where(eq(patients.id, "pat_01"));
      expect(after).toMatchObject({ diagnosis: "Updated", primaryStaffId: "stf_tan" });
      const backups = await tx
        .select()
        .from(patientBackupStaff)
        .where(eq(patientBackupStaff.patientId, "pat_01"));
      expect(backups.map((b) => b.staffId)).toEqual(["stf_ramos"]);

      // Amara Cruz is neither Jolyn's patient nor her backup patient.
      const other = { id: "pat_02" };
      await expect(
        updatePatient(tx, ACTORS.therapist, { patientId: other.id, values: newPatient }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        setPatientStatus(tx, ACTORS.therapist, { patientId: "pat_01", status: "inactive" }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }));
});
