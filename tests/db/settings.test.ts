import { and, eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { listSessionTypes } from "@/server/db/queries/session-types";
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
  updateSessionTypeDuration,
  createStaff,
  moveSessionType,
  removeSessionType,
  renameSessionType,
  saveSessionTypes,
  staffWithLoad,
  updateBranchHours,
  updateRateClasses,
  updateSessionTypeRate,
  updateSessionTypeService,
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
      await updateRateClasses(tx, ACTORS.owner, {
        branchId: "br_bangkal",
        rows: [{ id: "rc_ot", therapistSharePct: 60 }],
      });
      expect(await payrollTotal(tx)).toBe(before);

      // Sessions marked attended after the change use the new snapshot.
      const after = await setAppointmentStatus(tx, ACTORS.desk, {
        appointmentId: "apt_20260822_11_delarosa",
        status: "attended",
      });
      // The session's own fee, at the new share.
      expect(after).toMatchObject({ payrollRateCentavos: 70_000, payrollSharePct: 60 });

      const [entry] = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.entity, "rate_class"), eq(auditLog.entityId, "rc_ot")));
      expect(entry).toMatchObject({
        before: { therapistSharePct: 70 },
        after: { therapistSharePct: 60 },
      });
    }));

  it("rejects shares over 100%", () =>
    inRollback(async (tx) => {
      await expect(
        updateRateClasses(tx, ACTORS.owner, {
          branchId: "br_bangkal",
          rows: [{ id: "rc_ot", therapistSharePct: 120 }],
        }),
      ).rejects.toThrow(/0 to 100/);
    }));

  it("only the owner manages settings", () =>
    inRollback(async (tx) => {
      await expect(
        updateRateClasses(tx, ACTORS.desk, {
          branchId: "br_bangkal",
          rows: [{ id: "rc_ot", therapistSharePct: 1 }],
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        createBranch(tx, ACTORS.therapist, { name: "CRB Toril" }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }));
});

describe("session types", () => {
  it("a new default fee never changes booked sessions", () =>
    inRollback(async (tx) => {
      await updateSessionTypeRate(tx, ACTORS.owner, {
        branchId: "br_bangkal",
        id: "st_ot",
        ratePesos: 800,
      });
      const [booked] = await tx
        .select()
        .from(appointments)
        .where(eq(appointments.id, "apt_20260829_09_delarosa"));
      expect(booked!.feeCentavos).toBe(70_000);
    }));

  it("adds, removes (soft) and restores a type", () =>
    inRollback(async (tx) => {
      const id = await createSessionType(tx, ACTORS.owner, {
        branchId: "br_bangkal",
        values: { name: "OT group session", ratePesos: 400 },
      });
      await expect(
        createSessionType(tx, ACTORS.owner, {
          branchId: "br_bangkal",
          values: { name: "ot group session", ratePesos: 400 },
        }),
      ).rejects.toThrow(/already/);
      await removeSessionType(tx, ACTORS.owner, { branchId: "br_bangkal", id });
      const [removed] = await tx.select().from(sessionTypes).where(eq(sessionTypes.id, id));
      expect(removed!.active).toBe(false);
      expect(
        await createSessionType(tx, ACTORS.owner, {
          branchId: "br_bangkal",
          values: { name: "OT group session", ratePesos: 450 },
        }),
      ).toBe(id);
    }));

  it("moves a type up and down, which changes the booking default", () =>
    inRollback(async (tx) => {
      const names = async () =>
        (await listSessionTypes(tx, { branchId: "br_bangkal" })).map((t) => t.name);
      const before = await names();
      const last = (await listSessionTypes(tx, { branchId: "br_bangkal" })).at(-1)!;
      await moveSessionType(tx, ACTORS.owner, {
        branchId: "br_bangkal",
        id: last.id,
        direction: "up",
      });
      const moved = await names();
      expect(moved.at(-2)).toBe(last.name);
      await moveSessionType(tx, ACTORS.owner, {
        branchId: "br_bangkal",
        id: last.id,
        direction: "up",
      });
      expect(await names()).toEqual(
        before.length > 2 ? [...before.slice(0, -3), last.name, ...before.slice(-3, -1)] : moved,
      );
      // Past the ends nothing changes.
      const top = (await listSessionTypes(tx, { branchId: "br_bangkal" }))[0]!;
      const snapshot = await names();
      await moveSessionType(tx, ACTORS.owner, {
        branchId: "br_bangkal",
        id: top.id,
        direction: "up",
      });
      expect(await names()).toEqual(snapshot);
    }));

  it("sets and changes a type's time interval", () =>
    inRollback(async (tx) => {
      const id = await createSessionType(tx, ACTORS.owner, {
        branchId: "br_bangkal",
        values: { name: "Quick check-in", ratePesos: 350, durationMinutes: 30 },
      });
      const [created] = await tx.select().from(sessionTypes).where(eq(sessionTypes.id, id));
      expect(created!.durationMinutes).toBe(30);
      await updateSessionTypeDuration(tx, ACTORS.owner, {
        branchId: "br_bangkal",
        id,
        durationMinutes: 60,
      });
      const [changed] = await tx.select().from(sessionTypes).where(eq(sessionTypes.id, id));
      expect(changed!.durationMinutes).toBe(60);
      await expect(
        updateSessionTypeDuration(tx, ACTORS.owner, {
          branchId: "br_bangkal",
          id,
          durationMinutes: 45,
        }),
      ).rejects.toThrow();
    }));

  it("renames a type and changes its color, rejecting a name already in use", () =>
    inRollback(async (tx) => {
      const id = await createSessionType(tx, ACTORS.owner, {
        branchId: "br_bangkal",
        values: { name: "Group play", ratePesos: 500, durationMinutes: 60 },
      });
      await createSessionType(tx, ACTORS.owner, {
        branchId: "br_bangkal",
        values: { name: "Parent talk", ratePesos: 300, durationMinutes: 30 },
      });
      await renameSessionType(tx, ACTORS.owner, { branchId: "br_bangkal", id, name: " Group OT " });
      await updateSessionTypeService(tx, ACTORS.owner, {
        branchId: "br_bangkal",
        id,
        service: "speech",
      });
      const [changed] = await tx.select().from(sessionTypes).where(eq(sessionTypes.id, id));
      expect(changed!.name).toBe("Group OT");
      expect(changed!.service).toBe("speech");
      await updateSessionTypeService(tx, ACTORS.owner, {
        branchId: "br_bangkal",
        id,
        service: null,
      });
      const [cleared] = await tx.select().from(sessionTypes).where(eq(sessionTypes.id, id));
      expect(cleared!.service).toBeNull();
      await expect(
        renameSessionType(tx, ACTORS.owner, { branchId: "br_bangkal", id, name: "parent talk" }),
      ).rejects.toThrow(/already a session type/);
      await expect(
        updateSessionTypeService(tx, ACTORS.owner, { branchId: "br_bangkal", id, service: "aide" }),
      ).rejects.toThrow();
    }));

  it("saves several edits together, and a rejected row saves none of them", async () => {
    const db = testDb();
    const types = await listSessionTypes(db, { branchId: "br_bangkal" });
    const [first, second, third] = types;
    const row = (t: typeof first) => ({
      id: t!.id,
      name: t!.name,
      service: t!.service,
      ratePesos: t!.rateCentavos / 100,
      durationMinutes: t!.durationMinutes as 30 | 60,
    });
    await inRollback(async (tx) => {
      await saveSessionTypes(tx, ACTORS.owner, {
        branchId: "br_bangkal",
        rows: [
          { ...row(first), name: "Renamed one", ratePesos: 999 },
          { ...row(second), service: null, durationMinutes: 30 },
        ],
      });
      const after = await listSessionTypes(tx, { branchId: "br_bangkal" });
      const one = after.find((t) => t.id === first!.id)!;
      const two = after.find((t) => t.id === second!.id)!;
      expect([one.name, one.rateCentavos]).toEqual(["Renamed one", 99_900]);
      expect([two.service, two.durationMinutes]).toEqual([null, 30]);
    });
    await expect(
      db.transaction((tx) =>
        saveSessionTypes(tx, ACTORS.owner, {
          branchId: "br_bangkal",
          rows: [
            { ...row(first), name: "Should not stick" },
            { ...row(second), name: third!.name.toUpperCase() },
          ],
        }),
      ),
    ).rejects.toThrow(/already a session type/);
    const unchanged = await listSessionTypes(db, { branchId: "br_bangkal" });
    expect(unchanged.find((t) => t.id === first!.id)!.name).toBe(first!.name);
    await expect(
      saveSessionTypes(db, ACTORS.desk, { branchId: "br_bangkal", rows: [row(first)] }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
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
