import { and, eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@/server/auth/permissions";
import {
  appointments,
  auditLog,
  branches,
  receiptCounters,
  sessionTypes,
  staff,
} from "@/server/db/schema";
import { setAppointmentStatus } from "@/server/services/appointments";
import {
  createBranch,
  createSessionType,
  createStaff,
  removeSessionType,
  staffWithLoad,
  updateBranchHours,
  updateRateClasses,
  updateSessionTypeRate,
} from "@/server/services/settings";

import { ACTORS } from "../support/actors";
import { inRollback, testDb } from "./support";

const payrollTotal = async (tx: Parameters<Parameters<typeof inRollback>[0]>[0]) => {
  const [row] = await tx.execute<{ total: number }>(
    sql`select coalesce(sum(payroll_rate_centavos * payroll_share_pct / 100), 0)::int as total from appointments where status = 'attended' and starts_at < '2026-08-22T00:00:00+08:00'`,
  );
  return row!.total;
};

describe("rates and splits", () => {
  it("a rate change leaves past payroll exactly as it was", () =>
    inRollback(async (tx) => {
      const before = await payrollTotal(tx);
      await updateRateClasses(tx, ACTORS.owner, [
        { id: "rc_ot", ratePesos: 900, therapistSharePct: 60 },
      ]);
      expect(await payrollTotal(tx)).toBe(before);

      // Sessions marked attended after the change use the new snapshot.
      const after = await setAppointmentStatus(tx, ACTORS.desk, {
        appointmentId: "apt_20260822_11_delarosa",
        status: "attended",
      });
      expect(after).toMatchObject({ payrollRateCentavos: 90_000, payrollSharePct: 60 });

      const [entry] = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.entity, "rate_class"), eq(auditLog.entityId, "rc_ot")));
      expect(entry).toMatchObject({
        before: { rateCentavos: 70_000 },
        after: { rateCentavos: 90_000 },
      });
    }));

  it("rejects shares over 100%", () =>
    inRollback(async (tx) => {
      await expect(
        updateRateClasses(tx, ACTORS.owner, [
          { id: "rc_ot", ratePesos: 700, therapistSharePct: 120 },
        ]),
      ).rejects.toThrow(/0 to 100/);
    }));

  it("only the owner manages settings", () =>
    inRollback(async (tx) => {
      await expect(
        updateRateClasses(tx, ACTORS.desk, [{ id: "rc_ot", ratePesos: 1, therapistSharePct: 1 }]),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        createBranch(tx, ACTORS.therapist, { name: "CRB Toril" }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }));
});

describe("session types", () => {
  it("a new default fee never changes booked sessions", () =>
    inRollback(async (tx) => {
      await updateSessionTypeRate(tx, ACTORS.owner, { id: "st_ot", ratePesos: 800 });
      const [booked] = await tx
        .select()
        .from(appointments)
        .where(eq(appointments.id, "apt_20260829_09_delarosa"));
      expect(booked!.feeCentavos).toBe(70_000);
    }));

  it("adds, removes (soft) and restores a type", () =>
    inRollback(async (tx) => {
      const id = await createSessionType(tx, ACTORS.owner, {
        name: "OT group session",
        ratePesos: 400,
      });
      await expect(
        createSessionType(tx, ACTORS.owner, { name: "ot group session", ratePesos: 400 }),
      ).rejects.toThrow(/already/);
      await removeSessionType(tx, ACTORS.owner, { id });
      const [removed] = await tx.select().from(sessionTypes).where(eq(sessionTypes.id, id));
      expect(removed!.active).toBe(false);
      expect(
        await createSessionType(tx, ACTORS.owner, { name: "OT group session", ratePesos: 450 }),
      ).toBe(id);
    }));
});

describe("staff and branches", () => {
  it("adds staff, optionally with a login", () =>
    inRollback(async (tx) => {
      const { staffId, account } = await createStaff(tx, ACTORS.owner, {
        branchId: "br_bangkal",
        values: {
          displayName: "Rita Cruz, OTRP",
          rateClassId: "rc_ot",
          loginEmail: "rita@example.test",
        },
      });
      const [row] = await tx.select().from(staff).where(eq(staff.id, staffId));
      expect(row).toMatchObject({
        shortName: "R. Cruz, OTRP",
        surname: "Cruz",
        userId: account!.userId,
      });
    }));

  it("computes this month's load per staff member", async () => {
    const rows = await staffWithLoad(testDb(), "br_bangkal");
    const delaRosa = rows.find((r) => r.id === "stf_delarosa")!;
    expect(delaRosa.monthSessions).toBeGreaterThan(0);
    expect(delaRosa.utilizationPct).toBeGreaterThan(0);
  });

  it("creates a branch with its own receipt counter, joined by the owner", () =>
    inRollback(async (tx) => {
      const branch = await createBranch(tx, ACTORS.owner, {
        name: "CRB Toril",
        location: "Toril, Davao City",
      });
      expect(branch).toMatchObject({ code: "B3", receiptPrefix: "CRBT" });
      const [counter] = await tx
        .select()
        .from(receiptCounters)
        .where(eq(receiptCounters.branchId, branch.id));
      expect(counter!.nextNumber).toBe(1);
      await expect(createBranch(tx, ACTORS.owner, { name: "crb toril" })).rejects.toThrow(
        /already/,
      );
    }));

  it("saves operating hours and rejects closing before opening", () =>
    inRollback(async (tx) => {
      await updateBranchHours(tx, ACTORS.owner, {
        branchId: "br_bangkal",
        values: { openDays: [1, 2, 3, 4, 5], opensAtHour: 8, closesAtHour: 18 },
      });
      const [row] = await tx.select().from(branches).where(eq(branches.id, "br_bangkal"));
      expect(row).toMatchObject({ openDays: [1, 2, 3, 4, 5], opensAtHour: 8, closesAtHour: 18 });
      await expect(
        updateBranchHours(tx, ACTORS.owner, {
          branchId: "br_bangkal",
          values: { openDays: [1], opensAtHour: 17, closesAtHour: 9 },
        }),
      ).rejects.toThrow(/Closing time/);
    }));
});
