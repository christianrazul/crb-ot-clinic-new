import "server-only";

import { addDays, format, parseISO } from "date-fns";
import { and, asc, eq, gte, lt } from "drizzle-orm";

import { fromManilaLocal } from "@/lib/dates";
import { payrollLine, sumPayroll, type PayrollLine } from "@/lib/payroll";
import { payrollRange, type PayrollPeriod } from "@/lib/payroll-periods";
import type { ServiceKey } from "@/lib/services";
import type { Actor } from "@/server/auth/actor";
import { assertCan } from "@/server/auth/permissions";
import type { DbExecutor } from "@/server/db/client";
import { appointments, rateClasses, staff } from "@/server/db/schema";

export type PayrollRow = {
  staffId: string;
  name: string;
  rateClassName: string;
  service: ServiceKey;
  /** The therapist share when every session in the period used the same one, else null. */
  sharePct: number | null;
  line: PayrollLine;
};

/**
 * Payroll for one branch and period, from attended sessions only. Each
 * session's fee is split with the therapist share snapshotted when it was
 * marked attended (D-037, D-119): a 70% therapist on a ₱1,400 evaluation earns
 * ₱980 and the clinic keeps ₱420. Later changes never rewrite past payroll.
 */
export async function getPayroll(
  db: DbExecutor,
  actor: Actor,
  input: { branchId: string; period: PayrollPeriod; date: string },
) {
  assertCan(actor, "payroll:read", { branchId: input.branchId });
  const range = payrollRange(input.period, input.date);
  const sessions = await db
    .select({
      staffId: staff.id,
      name: staff.displayName,
      sortOrder: staff.sortOrder,
      rateClassName: rateClasses.name,
      service: rateClasses.service,
      rate: appointments.payrollRateCentavos,
      share: appointments.payrollSharePct,
    })
    .from(appointments)
    .innerJoin(staff, eq(appointments.staffId, staff.id))
    .innerJoin(rateClasses, eq(staff.rateClassId, rateClasses.id))
    .where(
      and(
        eq(appointments.branchId, input.branchId),
        eq(appointments.status, "attended"),
        gte(appointments.startsAt, fromManilaLocal(range.from, "00:00")),
        lt(appointments.startsAt, fromManilaLocal(range.to, "00:00")),
      ),
    )
    .orderBy(asc(staff.sortOrder), asc(staff.displayName));

  const byStaff = new Map<string, { row: Omit<PayrollRow, "line">; lines: PayrollLine[] }>();
  for (const s of sessions) {
    // The check constraint guarantees attended sessions carry a snapshot.
    const line = payrollLine(1, s.rate ?? 0, s.share ?? 0);
    const entry = byStaff.get(s.staffId);
    if (!entry) {
      byStaff.set(s.staffId, {
        row: {
          staffId: s.staffId,
          name: s.name,
          rateClassName: s.rateClassName,
          service: s.service,
          sharePct: s.share,
        },
        lines: [line],
      });
    } else {
      if (entry.row.sharePct !== s.share) entry.row.sharePct = null;
      entry.lines.push(line);
    }
  }
  const rows: PayrollRow[] = [...byStaff.values()].map(({ row, lines }) => {
    const total = sumPayroll(lines);
    return { ...row, line: { ...total, rateCentavos: 0 } };
  });
  return {
    period: input.period,
    date: input.date,
    from: range.from,
    /** Last day included, for captions. */
    through: format(addDays(parseISO(range.to), -1), "yyyy-MM-dd"),
    rows,
    totals: sumPayroll(rows.map((r) => r.line)),
  };
}
export type PayrollReport = Awaited<ReturnType<typeof getPayroll>>;

/** Spreadsheet apps run cells starting with these as formulas. */
const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value: string | number) {
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const pesos = (centavos: number) => (centavos / 100).toFixed(2);

/** The report as CSV: one row per staff member and a total. Amounts in pesos. */
export function payrollCsv(report: PayrollReport, branchName: string) {
  const lines = [
    [
      "Branch",
      "From",
      "Through",
      "Staff",
      "Rate class",
      "Sessions",
      "Share (%)",
      "Gross (PHP)",
      "Therapist share (PHP)",
      "Clinic share (PHP)",
    ],
    ...report.rows.map((r) => [
      branchName,
      report.from,
      report.through,
      r.name,
      r.rateClassName,
      r.line.sessions,
      r.sharePct === null ? "Varies" : r.sharePct,
      pesos(r.line.grossCentavos),
      pesos(r.line.therapistShareCentavos),
      pesos(r.line.clinicShareCentavos),
    ]),
    [
      branchName,
      report.from,
      report.through,
      "Total",
      "",
      report.totals.sessions,
      "",
      pesos(report.totals.grossCentavos),
      pesos(report.totals.therapistShareCentavos),
      pesos(report.totals.clinicShareCentavos),
    ],
  ];
  return lines.map((cells) => cells.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
