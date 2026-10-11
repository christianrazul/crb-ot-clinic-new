import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@/server/auth/permissions";
import { auditLog } from "@/server/db/schema";
import { getDashboard } from "@/server/services/dashboard";
import { listExpenses, recordExpense } from "@/server/services/expenses";

import { ACTORS } from "../support/actors";
import { inRollback, testDb } from "./support";

const bangkal = { branchId: "br_bangkal" };

describe("dashboard", () => {
  it("computes the month's figures from the database", async () => {
    const data = await getDashboard(testDb(), ACTORS.owner, bangkal);
    expect(data.monthLabel).toBe("August");
    // Cash for sessions not paid from credit, plus advance top-ups.
    expect(data.kpis.incomeCentavos).toBe(6_720_000 + 700_000);
    expect(data.kpis.sessions).toBe(101);
    expect(data.kpis.sessionsDeltaPct).toBeNull(); // nothing in July to compare with
    expect(data.kpis.activePatients).toBe(16);
    expect(data.kpis.noShowRatePct).toBeCloseTo((5 / 106) * 100, 5);

    expect(data.cashFlow).toHaveLength(8);
    expect(data.cashFlow.map((m) => m.month)).toEqual([
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
    ]);
    expect(data.cashFlow.at(-1)!.expenses).toBe(3_815_000);
    expect(data.cashFlow.at(-2)!.income).toBe(700_000);

    expect(data.sessionsByService.reduce((s, r) => s + r.sessions, 0)).toBe(101);
    expect(data.frequentNoShows.map((p) => [p.patientId, p.count])).toEqual([
      ["pat_03", 3],
      ["pat_05", 2],
    ]);
    expect(data.earnings.reduce((s, e) => s + e.amount, 0)).toBe(5_247_000);
    // Up next: today's sessions that haven't ended at 10:20.
    expect(data.upNext.every((a) => new Date(a.startsAt) >= new Date("2026-08-22T02:00:00Z"))).toBe(
      true,
    );
  });

  it("is for the owner only", async () => {
    await expect(getDashboard(testDb(), ACTORS.desk, bangkal)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(getDashboard(testDb(), ACTORS.therapist, bangkal)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe("expenses", () => {
  it("records an expense with an audit entry and it shows in cash flow", () =>
    inRollback(async (tx) => {
      const row = await recordExpense(tx, ACTORS.owner, {
        ...bangkal,
        expense: { category: "Supplies", amountCentavos: 150_000, spentOn: "2026-08-21" },
      });
      const [audit] = await tx.select().from(auditLog).where(eq(auditLog.entityId, row.id));
      expect(audit).toMatchObject({ action: "expense.create", actorUserId: "usr_owner" });
      const data = await getDashboard(tx, ACTORS.owner, bangkal);
      expect(data.cashFlow.at(-1)!.expenses).toBe(3_815_000 + 150_000);
      const august = await listExpenses(tx, ACTORS.owner, {
        ...bangkal,
        from: "2026-08-01",
        to: "2026-09-01",
      });
      expect(august[0]).toMatchObject({ id: row.id });
    }));

  it("rejects bad input, future dates and anyone but the owner", () =>
    inRollback(async (tx) => {
      const good = { category: "Rent", amountCentavos: 100_000, spentOn: "2026-08-20" };
      await expect(
        recordExpense(tx, ACTORS.owner, { ...bangkal, expense: { ...good, category: "Party" } }),
      ).rejects.toThrow();
      await expect(
        recordExpense(tx, ACTORS.owner, {
          ...bangkal,
          expense: { ...good, spentOn: "2026-08-23" },
        }),
      ).rejects.toThrow(/future/);
      await expect(
        recordExpense(tx, ACTORS.desk, { ...bangkal, expense: good }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }));
});
