import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { payrollLine } from "@/lib/payroll";

import { ForbiddenError } from "@/server/auth/permissions";
import { setAppointmentStatus } from "@/server/services/appointments";
import { appointments } from "@/server/db/schema";
import { getPayroll, payrollCsv } from "@/server/services/payroll";
import { updateRateClasses } from "@/server/services/settings";

import { ACTORS } from "../support/actors";
import { inRollback, testDb } from "./support";

const august = { branchId: "br_bangkal", period: "monthly", date: "2026-08-22" } as const;

describe("payroll", () => {
  it("adds up attended sessions per staff member from their snapshots", async () => {
    const report = await getPayroll(testDb(), ACTORS.owner, august);
    expect(report).toMatchObject({ from: "2026-08-01", through: "2026-08-31" });
    expect(report.totals).toEqual({
      sessions: 101,
      grossCentavos: 7_390_000,
      therapistShareCentavos: 5_247_000,
      clinicShareCentavos: 2_143_000,
    });
    const delarosa = report.rows.find((r) => r.staffId === "stf_delarosa")!;
    expect(delarosa).toMatchObject({ sharePct: 70, rateClassName: expect.any(String) });
    expect(delarosa.line).toMatchObject({ sessions: 20, therapistShareCentavos: 980_000 });
  });

  it("covers Monday to Sunday for a week and one day for daily", async () => {
    const week = await getPayroll(testDb(), ACTORS.owner, { ...august, period: "weekly" });
    expect(week).toMatchObject({ from: "2026-08-17", through: "2026-08-23" });
    expect(week.totals.sessions).toBe(27);
    const day = await getPayroll(testDb(), ACTORS.owner, { ...august, period: "daily" });
    expect(day.rows.every((r) => r.line.sessions >= 1)).toBe(true);
    expect(day.totals.sessions).toBeLessThan(week.totals.sessions);
  });

  it("keeps past sessions at their old rate after a rate change", () =>
    inRollback(async (tx) => {
      await updateRateClasses(tx, ACTORS.owner, {
        branchId: "br_bangkal",
        rows: [{ id: "rc_ot", therapistSharePct: 60 }],
      });
      await setAppointmentStatus(tx, ACTORS.desk, {
        appointmentId: "apt_20260822_11_delarosa",
        status: "attended",
      });
      const report = await getPayroll(tx, ACTORS.owner, august);
      const delarosa = report.rows.find((r) => r.staffId === "stf_delarosa")!;
      expect(delarosa.sharePct).toBeNull();
      expect(delarosa.line).toMatchObject({
        sessions: 21,
        grossCentavos: 1_400_000 + 70_000,
        therapistShareCentavos: 980_000 + 42_000,
      });
    }));

  it("pays the therapist their share of the session's fee: 70% of a ₱1,400 evaluation is ₱980", () =>
    inRollback(async (tx) => {
      // An OT Evaluation priced at ₱1,400, run by an Occupational Therapist (70%).
      await tx
        .update(appointments)
        .set({ feeCentavos: 140_000 })
        .where(eq(appointments.id, "apt_20260822_11_delarosa"));
      const attended = await setAppointmentStatus(tx, ACTORS.desk, {
        appointmentId: "apt_20260822_11_delarosa",
        status: "attended",
      });
      expect(attended).toMatchObject({ payrollRateCentavos: 140_000, payrollSharePct: 70 });
      expect(payrollLine(1, 140_000, 70)).toMatchObject({
        therapistShareCentavos: 98_000,
        clinicShareCentavos: 42_000,
      });

      const day = await getPayroll(tx, ACTORS.owner, { ...august, period: "daily" });
      const delarosa = day.rows.find((r) => r.staffId === "stf_delarosa")!;
      // That day's earlier OT session (₱700) plus the evaluation.
      expect(delarosa.line).toMatchObject({
        grossCentavos: 70_000 + 140_000,
        therapistShareCentavos: 49_000 + 98_000,
        clinicShareCentavos: 21_000 + 42_000,
      });
    }));

  it("is for the owner only, and only for their branches", async () => {
    await expect(getPayroll(testDb(), ACTORS.desk, august)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getPayroll(testDb(), ACTORS.therapist, august)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      getPayroll(testDb(), { ...ACTORS.owner, branchIds: ["br_panabo"] }, august),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("exports CSV in pesos with a total row", async () => {
    const report = await getPayroll(testDb(), ACTORS.owner, august);
    const lines = payrollCsv(report, "CRB Bangkal").trim().split("\r\n");
    expect(lines[0]).toMatch(/^Branch,From,Through,Staff/);
    expect(lines).toHaveLength(report.rows.length + 2);
    expect(lines.at(-1)).toBe(
      "CRB Bangkal,2026-08-01,2026-08-31,Total,,101,,73900.00,52470.00,21430.00",
    );
  });

  it("neutralises cells a spreadsheet would run as formulas", async () => {
    const report = await getPayroll(testDb(), ACTORS.owner, august);
    const evil = { ...report, rows: [{ ...report.rows[0]!, name: '=HYPERLINK("x")' }] };
    expect(payrollCsv(evil, "CRB, Bangkal")).toContain(
      `"CRB, Bangkal",2026-08-01,2026-08-31,"'=HYPERLINK(""x"")"`,
    );
  });
});
