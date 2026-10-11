import { addDays, addMonths, format, parseISO, startOfMonth, startOfWeek } from "date-fns";

export const PAYROLL_PERIODS = ["daily", "weekly", "monthly"] as const;
export type PayrollPeriod = (typeof PAYROLL_PERIODS)[number];

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** The Manila calendar days a period covers: [from, to). Weeks start on Monday. */
export function payrollRange(period: PayrollPeriod, date: string) {
  const day = parseISO(date);
  if (period === "daily") return { from: date, to: iso(addDays(day, 1)) };
  if (period === "weekly") {
    const monday = startOfWeek(day, { weekStartsOn: 1 });
    return { from: iso(monday), to: iso(addDays(monday, 7)) };
  }
  const first = startOfMonth(day);
  return { from: iso(first), to: iso(addMonths(first, 1)) };
}

/** The period before or after the one containing `date`. */
export function shiftPeriod(period: PayrollPeriod, date: string, step: 1 | -1) {
  const { from } = payrollRange(period, date);
  const start = parseISO(from);
  if (period === "daily") return iso(addDays(start, step));
  if (period === "weekly") return iso(addDays(start, 7 * step));
  return iso(addMonths(start, step));
}
