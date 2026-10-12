import "server-only";

import { addDays, addMonths, format, parseISO } from "date-fns";
import { and, asc, count, eq, gte, inArray, isNull, lt, sql, sum } from "drizzle-orm";

import { ageOn } from "@/lib/age";
import { CLINIC_TIME_ZONE, fromManilaLocal } from "@/lib/dates";
import { payrollLine } from "@/lib/payroll";
import type { ServiceKey } from "@/lib/services";
import type { Actor } from "@/server/auth/actor";
import { assertCan } from "@/server/auth/permissions";
import { clinicNow, clinicToday } from "@/server/clock";
import type { DbExecutor } from "@/server/db/client";
import { liveCredit, livePayment } from "@/server/db/queries/billing";
import {
  appointments,
  creditLedger,
  expenses,
  patients,
  payments,
  rateClasses,
  sessionTypes,
  staff,
} from "@/server/db/schema";

const MONTHS_OF_CASH_FLOW = 8;
const iso = (d: Date) => format(d, "yyyy-MM-dd");
// The zone is a constant, inlined so GROUP BY matches the selected expression.
const MANILA = sql.raw(`'${CLINIC_TIME_ZONE}'`);
const monthKey = (column: unknown) =>
  sql<string>`to_char(${column} at time zone ${MANILA}, 'YYYY-MM')`;

/** Percentage change, or null when there is nothing to compare with. */
function pctChange(now: number, before: number) {
  if (!before) return null;
  return Math.round(((now - before) / before) * 1000) / 10;
}

/**
 * Money received per Manila month: cash collected for sessions (the part not
 * paid from credit) plus advance top-ups. Credit spent was already counted
 * when it was topped up, so it is not counted again.
 */
async function incomeByMonth(db: DbExecutor, branchId: string, from: Date, to: Date) {
  const sessionMonth = monthKey(payments.createdAt);
  const sessionIncome = await db
    .select({
      month: sessionMonth,
      total: sql<string>`sum(${payments.amountCentavos} - ${payments.creditAppliedCentavos})`,
    })
    .from(payments)
    .where(
      and(
        eq(payments.branchId, branchId),
        livePayment,
        gte(payments.createdAt, from),
        lt(payments.createdAt, to),
      ),
    )
    .groupBy(sessionMonth);
  const topUpMonth = monthKey(creditLedger.createdAt);
  const topUps = await db
    .select({ month: topUpMonth, total: sum(creditLedger.amountCentavos) })
    .from(creditLedger)
    .innerJoin(patients, eq(creditLedger.patientId, patients.id))
    .where(
      and(
        eq(patients.branchId, branchId),
        eq(creditLedger.type, "top_up"),
        liveCredit,
        gte(creditLedger.createdAt, from),
        lt(creditLedger.createdAt, to),
      ),
    )
    .groupBy(topUpMonth);
  const totals = new Map<string, number>();
  for (const row of [...sessionIncome, ...topUps]) {
    totals.set(row.month, (totals.get(row.month) ?? 0) + Number(row.total ?? 0));
  }
  return totals;
}

async function expensesByMonth(db: DbExecutor, branchId: string, from: string, to: string) {
  const month = sql<string>`to_char(${expenses.spentOn}, 'YYYY-MM')`;
  const rows = await db
    .select({ month, total: sum(expenses.amountCentavos) })
    .from(expenses)
    .where(
      and(eq(expenses.branchId, branchId), gte(expenses.spentOn, from), lt(expenses.spentOn, to)),
    )
    .groupBy(month);
  return new Map(rows.map((r) => [r.month, Number(r.total ?? 0)]));
}

/** Appointment counts by status for one month. */
async function statusCounts(db: DbExecutor, branchId: string, from: Date, to: Date) {
  const rows = await db
    .select({ status: appointments.status, n: count() })
    .from(appointments)
    .where(
      and(
        eq(appointments.branchId, branchId),
        gte(appointments.startsAt, from),
        lt(appointments.startsAt, to),
      ),
    )
    .groupBy(appointments.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>;
  const attended = by.attended ?? 0;
  const noShow = by.no_show ?? 0;
  const cancelled = by.cancelled ?? 0;
  return { attended, noShow, cancelled };
}

const noShowRate = (c: { attended: number; noShow: number }) =>
  c.attended + c.noShow ? (c.noShow / (c.attended + c.noShow)) * 100 : 0;

/** The owner's dashboard for one branch, computed with SQL aggregates on each load. */
export async function getDashboard(db: DbExecutor, actor: Actor, input: { branchId: string }) {
  assertCan(actor, "dashboard:read", { branchId: input.branchId });
  const { branchId } = input;
  const today = clinicToday();
  const now = clinicNow();
  const monthStart = parseISO(`${today.slice(0, 7)}-01`);
  const at = (d: Date) => fromManilaLocal(iso(d), "00:00");
  const thisMonth = { from: at(monthStart), to: at(addMonths(monthStart, 1)) };
  const lastMonth = { from: at(addMonths(monthStart, -1)), to: thisMonth.from };

  // Cash flow, oldest month first.
  const flowStart = addMonths(monthStart, -(MONTHS_OF_CASH_FLOW - 1));
  const [income, spent] = await Promise.all([
    incomeByMonth(db, branchId, at(flowStart), thisMonth.to),
    expensesByMonth(db, branchId, iso(flowStart), iso(addMonths(monthStart, 1))),
  ]);
  const cashFlow = Array.from({ length: MONTHS_OF_CASH_FLOW }, (_, i) => {
    const month = addMonths(flowStart, i);
    const key = format(month, "yyyy-MM");
    return {
      month: format(month, "MMM"),
      year: format(month, "yyyy"),
      income: income.get(key) ?? 0,
      expenses: spent.get(key) ?? 0,
    };
  });

  const [current, previous] = await Promise.all([
    statusCounts(db, branchId, thisMonth.from, thisMonth.to),
    statusCounts(db, branchId, lastMonth.from, lastMonth.to),
  ]);

  const [activeRow] = await db
    .select({
      active: sql<number>`count(*) filter (where ${patients.status} = 'active')`.mapWith(Number),
      enrolled:
        sql<number>`count(*) filter (where ${patients.status} = 'active' and ${patients.enrolledOn} >= ${iso(monthStart)})`.mapWith(
          Number,
        ),
    })
    .from(patients)
    .where(and(eq(patients.branchId, branchId), isNull(patients.deletedAt)));

  // Sessions this month by the service of the session type (aide sessions are OT sessions).
  const byService = await db
    .select({ service: sessionTypes.service, n: count() })
    .from(appointments)
    .innerJoin(sessionTypes, eq(appointments.sessionTypeId, sessionTypes.id))
    .where(
      and(
        eq(appointments.branchId, branchId),
        eq(appointments.status, "attended"),
        gte(appointments.startsAt, thisMonth.from),
        lt(appointments.startsAt, thisMonth.to),
      ),
    )
    .groupBy(sessionTypes.service);

  const frequentNoShows = await db
    .select({
      patientId: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      dateOfBirth: patients.dateOfBirth,
      service: patients.service,
      n: count(),
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .where(
      and(
        eq(appointments.branchId, branchId),
        eq(appointments.status, "no_show"),
        gte(appointments.startsAt, thisMonth.from),
        lt(appointments.startsAt, thisMonth.to),
      ),
    )
    .groupBy(patients.id)
    .having(sql`count(*) >= 2`)
    .orderBy(sql`count(*) desc`, asc(patients.firstName));

  // Therapist share this month per rate class, from payroll snapshots (D-084).
  const earningRows = await db
    .select({
      rateClassId: rateClasses.id,
      name: rateClasses.name,
      shortName: rateClasses.shortName,
      service: rateClasses.service,
      staffId: staff.id,
      rate: appointments.payrollRateCentavos,
      share: appointments.payrollSharePct,
      n: count(),
    })
    .from(appointments)
    .innerJoin(staff, eq(appointments.staffId, staff.id))
    .innerJoin(rateClasses, eq(staff.rateClassId, rateClasses.id))
    .where(
      and(
        eq(appointments.branchId, branchId),
        eq(appointments.status, "attended"),
        gte(appointments.startsAt, thisMonth.from),
        lt(appointments.startsAt, thisMonth.to),
      ),
    )
    .groupBy(
      rateClasses.id,
      staff.id,
      appointments.payrollRateCentavos,
      appointments.payrollSharePct,
    );
  const SERVICE_ORDER: ServiceKey[] = ["ot", "speech", "aide", "sped", "none"];
  const earnings = new Map<
    string,
    { name: string; shortName: string; service: ServiceKey; amount: number; staff: Set<string> }
  >();
  for (const r of earningRows) {
    const entry = earnings.get(r.rateClassId) ?? {
      name: r.name,
      shortName: r.shortName,
      service: r.service,
      amount: 0,
      staff: new Set<string>(),
    };
    entry.amount += payrollLine(r.n, r.rate ?? 0, r.share ?? 0).therapistShareCentavos;
    entry.staff.add(r.staffId);
    earnings.set(r.rateClassId, entry);
  }

  // Today's sessions that have not ended, earliest first.
  const tomorrow = iso(addDays(parseISO(today), 1));
  const todays = await db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      status: appointments.status,
      firstName: patients.firstName,
      lastName: patients.lastName,
      dateOfBirth: patients.dateOfBirth,
      typeService: sessionTypes.service,
      rateService: rateClasses.service,
      staffName: staff.shortName,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(sessionTypes, eq(appointments.sessionTypeId, sessionTypes.id))
    .innerJoin(staff, eq(appointments.staffId, staff.id))
    .innerJoin(rateClasses, eq(staff.rateClassId, rateClasses.id))
    .where(
      and(
        eq(appointments.branchId, branchId),
        gte(appointments.startsAt, fromManilaLocal(today, "00:00")),
        lt(appointments.startsAt, fromManilaLocal(tomorrow, "00:00")),
        inArray(appointments.status, ["scheduled", "checked_in", "attended", "no_show"]),
      ),
    )
    .orderBy(asc(appointments.startsAt), asc(staff.sortOrder));
  const upNext = todays.filter((a) => a.endsAt > now).slice(0, 5);

  const monthIncome = cashFlow.at(-1)!.income;
  const previousIncome = cashFlow.at(-2)?.income ?? 0;
  const lastNet = (rows: typeof cashFlow) => rows.reduce((s, r) => s + r.income - r.expenses, 0);
  const statusTotal = current.attended + current.noShow + current.cancelled;
  const pct = (n: number) => (statusTotal ? Math.round((n / statusTotal) * 100) : 0);

  return {
    today,
    nowIso: now.toISOString(),
    monthLabel: format(monthStart, "MMMM"),
    todayCount: todays.length,
    kpis: {
      incomeCentavos: monthIncome,
      incomeDeltaPct: pctChange(monthIncome, previousIncome),
      sessions: current.attended,
      sessionsDeltaPct: pctChange(current.attended, previous.attended),
      activePatients: activeRow?.active ?? 0,
      newPatients: activeRow?.enrolled ?? 0,
      noShowRatePct: noShowRate(current),
      noShowDeltaPts:
        previous.attended + previous.noShow
          ? Math.round((noShowRate(current) - noShowRate(previous)) * 10) / 10
          : null,
    },
    cashFlow,
    /** Net cash change of the last month against the one before, for the badge. */
    netDeltaPct: pctChange(lastNet(cashFlow.slice(-1)), lastNet(cashFlow.slice(-2, -1))),
    sessionsByService: byService
      .map((r) => ({ service: (r.service ?? "none") as ServiceKey, sessions: r.n }))
      .filter((r) => r.sessions > 0)
      .sort((a, b) => SERVICE_ORDER.indexOf(a.service) - SERVICE_ORDER.indexOf(b.service)),
    attendance: {
      attendedPct: pct(current.attended),
      noShowPct: pct(current.noShow),
      cancelledPct: pct(current.cancelled),
    },
    frequentNoShows: frequentNoShows.map((p) => ({
      patientId: p.patientId,
      name: `${p.firstName} ${p.lastName}`,
      age: p.dateOfBirth ? ageOn(p.dateOfBirth, today) : null,
      service: p.service,
      count: p.n,
    })),
    earnings: [...earnings.values()]
      .sort((a, b) => SERVICE_ORDER.indexOf(a.service) - SERVICE_ORDER.indexOf(b.service))
      .map((e) => ({
        label: e.service === "aide" ? e.shortName : e.staff.size > 1 ? `${e.name}s` : e.name,
        service: e.service,
        amount: e.amount,
      })),
    upNext: upNext.map((a) => ({
      id: a.id,
      startsAt: a.startsAt.toISOString(),
      status: a.status,
      patientName: `${a.firstName} ${a.lastName}`,
      age: a.dateOfBirth ? ageOn(a.dateOfBirth, today) : null,
      service: (a.rateService === "aide" ? "aide" : (a.typeService ?? "none")) as ServiceKey,
      staffName: a.staffName.split(",")[0]!,
    })),
  };
}
export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
