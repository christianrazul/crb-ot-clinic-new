import "server-only";

import { z } from "zod";

import { clinicToday } from "@/server/clock";
import { getDb } from "@/server/db/client";
import { PAYROLL_PERIODS, shiftPeriod } from "@/lib/payroll-periods";
import { getPayroll, payrollCsv } from "@/server/services/payroll";
import { getShellSession, type ShellSession } from "@/server/session/shell";

export const payrollParams = z.object({
  period: z.enum(PAYROLL_PERIODS).catch("monthly"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
});

export async function loadPayrollPage(session: ShellSession, raw: unknown) {
  const params = payrollParams.parse(raw);
  const today = clinicToday();
  const report = await getPayroll(getDb(), session.actor, {
    branchId: session.branch.id,
    period: params.period,
    date: params.date ?? today,
  });
  return {
    ...report,
    today,
    previous: shiftPeriod(report.period, report.date, -1),
    next: shiftPeriod(report.period, report.date, 1),
  };
}
export type PayrollPageData = Awaited<ReturnType<typeof loadPayrollPage>>;

/** The CSV download for the signed-in owner's current branch. Same permission check as the page. */
export async function exportPayrollCsv(raw: unknown) {
  const session = await getShellSession();
  const params = payrollParams.parse(raw);
  const report = await getPayroll(getDb(), session.actor, {
    branchId: session.branch.id,
    period: params.period,
    date: params.date ?? clinicToday(),
  });
  return {
    csv: payrollCsv(report, session.branch.name),
    filename: `payroll-${session.branch.code.toLowerCase()}-${report.from}-to-${report.through}.csv`,
  };
}
