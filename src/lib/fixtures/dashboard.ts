/**
 * Month-level figures the fixtures are too small to compute (they only cover a
 * few weeks). Milestone 11 replaces these with SQL aggregates.
 */
export const DASHBOARD_KPIS = {
  monthLabel: "August",
  incomeCentavos: 68_420_000,
  incomeDeltaPct: 8.4,
  sessions: 486,
  sessionsDeltaPct: 3.1,
  activePatients: 132,
  newPatients: 5,
  noShowRatePct: 6.0,
  noShowDeltaPts: 1.2,
};

/** Monthly income and expenses, in centavos. */
export const CASH_FLOW = [
  { month: "Jan", income: 58, expenses: 34 },
  { month: "Feb", income: 62, expenses: 38 },
  { month: "Mar", income: 55, expenses: 36 },
  { month: "Apr", income: 70, expenses: 40 },
  { month: "May", income: 74, expenses: 41 },
  { month: "Jun", income: 68, expenses: 39 },
  { month: "Jul", income: 82, expenses: 44 },
  { month: "Aug", income: 88, expenses: 46 },
].map((row) => ({
  month: row.month,
  income: row.income * 780_000,
  expenses: row.expenses * 780_000,
}));

export const NET_CASH_DELTA_PCT = 6.2;

export const SESSIONS_BY_SERVICE = [
  { service: "ot", sessions: 272 },
  { service: "speech", sessions: 136 },
  { service: "sped", sessions: 78 },
] as const;

export const ATTENDANCE_MIX = { attendedPct: 91, noShowPct: 6, cancelledPct: 3 };

/** The therapist's own weekly earnings this month, in centavos. */
export const THERAPIST_WEEKLY_EARNINGS = [
  { week: "Wk 1", amount: 1_120_000 },
  { week: "Wk 2", amount: 1_365_000 },
  { week: "Wk 3", amount: 1_470_000 },
  { week: "Wk 4", amount: 1_533_000 },
];
