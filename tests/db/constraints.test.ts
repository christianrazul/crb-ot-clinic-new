import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { fromManilaLocal } from "@/lib/dates";
import { takeReceiptNumber } from "@/server/db/queries/billing";
import * as t from "@/server/db/schema";

import { failureCode, inRollback, PG } from "./support";

const at = (date: string, time: string) => fromManilaLocal(date, time);
const appointment = (patch: Partial<typeof t.appointments.$inferInsert> = {}) => ({
  branchId: "br_bangkal",
  patientId: "pat_12",
  staffId: "stf_tan",
  sessionTypeId: "st_ot",
  startsAt: at("2026-09-08", "16:00"),
  endsAt: at("2026-09-08", "17:00"),
  feeCentavos: 70_000,
  ...patch,
});

describe("double booking is impossible", () => {
  it("rejects two overlapping appointments for one staff member", () =>
    inRollback(async (tx) => {
      await tx.insert(t.appointments).values(appointment());
      // Different patient, same therapist, same hour.
      expect(
        await failureCode(tx, (s) =>
          s.insert(t.appointments).values(appointment({ patientId: "pat_13" })),
        ),
      ).toBe(PG.exclusionViolation);
    }));

  it("rejects two overlapping appointments for one patient", () =>
    inRollback(async (tx) => {
      await tx.insert(t.appointments).values(appointment());
      expect(
        await failureCode(tx, (s) =>
          s.insert(t.appointments).values(appointment({ staffId: "stf_delarosa" })),
        ),
      ).toBe(PG.exclusionViolation);
    }));

  it("rejects partial overlaps too, not just identical times", () =>
    inRollback(async (tx) => {
      await tx
        .insert(t.appointments)
        .values(
          appointment({ startsAt: at("2026-09-08", "15:00"), endsAt: at("2026-09-08", "17:00") }),
        );
      expect(await failureCode(tx, (s) => s.insert(t.appointments).values(appointment()))).toBe(
        PG.exclusionViolation,
      );
    }));

  it("back-to-back sessions are fine", () =>
    inRollback(async (tx) => {
      await tx.insert(t.appointments).values(appointment());
      await tx
        .insert(t.appointments)
        .values(
          appointment({ startsAt: at("2026-09-08", "15:00"), endsAt: at("2026-09-08", "16:00") }),
        );
    }));

  it("a cancelled or rescheduled appointment frees its slot", () =>
    inRollback(async (tx) => {
      const [first] = await tx.insert(t.appointments).values(appointment()).returning();
      await tx
        .update(t.appointments)
        .set({ status: "cancelled" })
        .where(eq(t.appointments.id, first!.id));
      await tx.insert(t.appointments).values(appointment({ patientId: "pat_13" }));
    }));

  it("an existing seeded slot cannot be double-booked", () =>
    inRollback(async (tx) => {
      // Tan has Gab Torres on Saturday, Aug 22 at 10:00.
      expect(
        await failureCode(tx, (s) =>
          s.insert(t.appointments).values(
            appointment({
              startsAt: at("2026-08-22", "10:00"),
              endsAt: at("2026-08-22", "11:00"),
            }),
          ),
        ),
      ).toBe(PG.exclusionViolation);
    }));
});

describe("appointment checks", () => {
  it("sessions start on the hour", () =>
    inRollback(async (tx) => {
      expect(
        await failureCode(tx, (s) =>
          s.insert(t.appointments).values(
            appointment({
              startsAt: at("2026-09-08", "16:30"),
              endsAt: at("2026-09-08", "17:30"),
            }),
          ),
        ),
      ).toBe(PG.checkViolation);
    }));

  it("an attended session must carry its payroll snapshot", () =>
    inRollback(async (tx) => {
      expect(
        await failureCode(tx, (s) =>
          s.insert(t.appointments).values(appointment({ status: "attended" })),
        ),
      ).toBe(PG.checkViolation);
    }));
});

describe("append-only history", () => {
  it("session notes cannot be edited or deleted", () =>
    inRollback(async (tx) => {
      expect(await failureCode(tx, (s) => s.update(t.sessionNotes).set({ body: "changed" }))).toBe(
        PG.restrictViolation,
      );
      expect(await failureCode(tx, (s) => s.delete(t.sessionNotes))).toBe(PG.restrictViolation);
    }));

  it("payments and the credit ledger cannot be edited or deleted", () =>
    inRollback(async (tx) => {
      expect(await failureCode(tx, (s) => s.update(t.payments).set({ amountCentavos: 1 }))).toBe(
        PG.restrictViolation,
      );
      expect(await failureCode(tx, (s) => s.delete(t.creditLedger))).toBe(PG.restrictViolation);
    }));
});

describe("money checks", () => {
  it("one payment per appointment", () =>
    inRollback(async (tx) => {
      expect(
        await failureCode(tx, (s) =>
          s.insert(t.payments).values({
            appointmentId: "apt_20260822_09_delarosa", // already paid in the seed
            patientId: "pat_01",
            branchId: "br_bangkal",
            amountCentavos: 70_000,
            method: "cash",
            cashReceivedCentavos: 70_000,
            receiptNo: "CRB-9999",
            receivedByUserId: "usr_desk",
          }),
        ),
      ).toBe(PG.uniqueViolation);
    }));

  it("non-cash payments need a reference and cash must cover the remainder", () =>
    inRollback(async (tx) => {
      const base = {
        appointmentId: "apt_20260822_09_ramos",
        patientId: "pat_03",
        branchId: "br_bangkal",
        amountCentavos: 70_000,
        receiptNo: "CRB-9998",
        receivedByUserId: "usr_desk",
      };
      expect(
        await failureCode(tx, (s) => s.insert(t.payments).values({ ...base, method: "gcash" })),
      ).toBe(PG.checkViolation);
      expect(
        await failureCode(tx, (s) =>
          s.insert(t.payments).values({ ...base, method: "cash", cashReceivedCentavos: 50_000 }),
        ),
      ).toBe(PG.checkViolation);
    }));

  it("ledger signs match the entry type", () =>
    inRollback(async (tx) => {
      const base = {
        patientId: "pat_02",
        description: "x",
        receiptNo: "CRB-9997",
        createdByUserId: "usr_desk",
      };
      expect(
        await failureCode(tx, (s) =>
          s
            .insert(t.creditLedger)
            .values({ ...base, type: "top_up", amountCentavos: -100, method: "cash" }),
        ),
      ).toBe(PG.checkViolation);
      expect(
        await failureCode(tx, (s) =>
          s.insert(t.creditLedger).values({ ...base, type: "deduction", amountCentavos: 100 }),
        ),
      ).toBe(PG.checkViolation);
    }));

  it("receipt numbers are taken in order and returned on rollback", () =>
    inRollback(async (tx) => {
      expect(await takeReceiptNumber(tx, "br_bangkal")).toBe("CRB-1100");
      await failureCode(tx, async (s) => {
        expect(await takeReceiptNumber(s, "br_bangkal")).toBe("CRB-1101");
        throw new Error("payment failed");
      });
      // The failed payment's number was rolled back, so there is no gap.
      expect(await takeReceiptNumber(tx, "br_bangkal")).toBe("CRB-1101");
      expect(await takeReceiptNumber(tx, "br_panabo")).toBe("CRBP-1");
      const [counter] = await tx.execute<{ next: number }>(
        sql`select next_number as next from receipt_counters where branch_id = 'br_bangkal'`,
      );
      expect(Number(counter!.next)).toBe(1102);
    }));
});
