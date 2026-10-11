"use client";

import { ArrowRight, CalendarClock, Info, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

import { ChartTooltipCard } from "@/components/app/chart-tooltip";
import { EmptyState } from "@/components/app/detail-bits";
import { Page, PageHeader } from "@/components/app/page-layout";
import { PatientAvatar } from "@/components/app/patient-avatar";
import { useViewer } from "@/components/app/shell/viewer-context";
import { StatStrip } from "@/components/app/stat-strip";
import { StatusBadge } from "@/components/app/status-badge";
import { SvcDot } from "@/components/app/svc-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { formatManila, manilaHour } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { SERVICE_BG, SERVICE_LABELS } from "@/lib/services";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/server/services/dashboard";

import { ExpenseDialog } from "./expense-dialog";

const cashFlowConfig = {
  income: { label: "Income", color: "var(--primary)" },
  expenses: { label: "Expenses", color: "var(--chart-muted)" },
} satisfies ChartConfig;

const mixConfig = {
  ot: { label: SERVICE_LABELS.ot, color: "var(--svc-ot)" },
  speech: { label: SERVICE_LABELS.speech, color: "var(--svc-speech)" },
  sped: { label: SERVICE_LABELS.sped, color: "var(--svc-sped)" },
  aide: { label: SERVICE_LABELS.aide, color: "var(--svc-aide)" },
  none: { label: SERVICE_LABELS.none, color: "var(--chart-muted)" },
} satisfies ChartConfig;

/** "8.4%" with the sign dropped (the arrow shows direction), or nothing to compare. */
const deltaText = (value: number | null, unit = "%") =>
  value === null ? undefined : `${Math.abs(value).toFixed(1).replace(/\.0$/, "")}${unit}`;

function greeting(nowIso: string) {
  const hour = manilaHour(new Date(nowIso));
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

export function DashboardScreen({ data, branchName }: { data: DashboardData; branchName: string }) {
  const viewer = useViewer();
  const [range, setRange] = React.useState("8");
  const { kpis, monthLabel } = data;

  const cashFlow = range === "8" ? data.cashFlow : data.cashFlow.slice(-3);
  const netCash = cashFlow.reduce((sum, row) => sum + row.income - row.expenses, 0);
  const totalSessions = data.sessionsByService.reduce((sum, row) => sum + row.sessions, 0);
  const maxEarning = Math.max(1, ...data.earnings.map((e) => e.amount));

  return (
    <Page>
      <PageHeader
        title={`${greeting(data.nowIso)}, ${viewer.user.name.split(" ")[0]}`}
        description={`${formatManila(new Date(data.nowIso), "longDay")}. There ${data.todayCount === 1 ? "is 1 session" : `are ${data.todayCount} sessions`} on the books today.`}
      >
        <ExpenseDialog branchName={branchName} today={data.today} />
        <Button variant="outline" size="sm" asChild>
          <Link href="/schedule">
            <CalendarClock /> Open schedule
          </Link>
        </Button>
      </PageHeader>

      <StatStrip
        items={[
          {
            label: `Income in ${monthLabel}`,
            value: formatPeso(kpis.incomeCentavos),
            delta: deltaText(kpis.incomeDeltaPct),
            up: (kpis.incomeDeltaPct ?? 0) >= 0,
            good: (kpis.incomeDeltaPct ?? 0) >= 0,
          },
          {
            label: "Sessions this month",
            value: kpis.sessions.toLocaleString("en-PH"),
            delta: deltaText(kpis.sessionsDeltaPct),
            up: (kpis.sessionsDeltaPct ?? 0) >= 0,
            good: (kpis.sessionsDeltaPct ?? 0) >= 0,
          },
          {
            label: "Active patients",
            value: kpis.activePatients,
            delta: kpis.newPatients ? `${kpis.newPatients} new` : undefined,
            up: true,
            good: true,
          },
          {
            label: "No-show rate",
            value: `${kpis.noShowRatePct.toFixed(1)}%`,
            delta: deltaText(kpis.noShowDeltaPts, " pts"),
            up: (kpis.noShowDeltaPts ?? 0) > 0,
            good: (kpis.noShowDeltaPts ?? 0) <= 0,
          },
        ]}
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div className="grid gap-1">
              <CardTitle>Cash flow</CardTitle>
              <CardDescription>Income against expenses, per month</CardDescription>
            </div>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger className="h-8 w-[150px] text-[13px]" aria-label="Cash flow range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="8">Last 8 months</SelectItem>
                <SelectItem value="3">Last 3 months</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <div className="text-xs text-muted-foreground">Net cash</div>
                <div className="text-3xl font-semibold tracking-tight tabular-nums">
                  {formatPeso(netCash)}
                </div>
              </div>
              {data.netDeltaPct !== null && (
                <Badge variant={data.netDeltaPct >= 0 ? "success" : "danger"} className="mb-1.5">
                  {data.netDeltaPct >= 0 ? <TrendingUp /> : <TrendingDown />}{" "}
                  {deltaText(data.netDeltaPct)}
                </Badge>
              )}
              <div className="mb-1 ml-auto flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2.5 rounded-[3px] bg-primary" />
                  Income
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-3 rounded bg-chart-muted" />
                  Expenses
                </span>
              </div>
            </div>
            <ChartContainer config={cashFlowConfig} className="mt-4 aspect-auto h-[240px] w-full">
              <AreaChart
                data={cashFlow}
                margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
                accessibilityLayer
              >
                <defs>
                  <linearGradient id="cash-flow-income" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-income)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--color-income)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                  fontSize={12}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  fontSize={12}
                  tickFormatter={(value: number) => `₱${Math.round(value / 100_000)}k`}
                />
                <ChartTooltip
                  cursor={{ stroke: "var(--border)" }}
                  content={<ChartTooltipCard money suffix={` ${data.cashFlow.at(-1)!.year}`} />}
                />
                <Area
                  dataKey="expenses"
                  type="monotone"
                  stroke="var(--color-expenses)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill="transparent"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Area
                  dataKey="income"
                  type="monotone"
                  stroke="var(--color-income)"
                  strokeWidth={2.5}
                  fill="url(#cash-flow-income)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--background)" }}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Sessions by service</CardTitle>
            <CardDescription>
              {totalSessions} sessions in {monthLabel}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col">
            <div className="relative mx-auto size-[180px]">
              <ChartContainer config={mixConfig} className="aspect-square size-full">
                <PieChart>
                  <Pie
                    data={data.sessionsByService}
                    dataKey="sessions"
                    nameKey="service"
                    innerRadius={62}
                    outerRadius={86}
                    paddingAngle={3}
                    cornerRadius={4}
                    stroke="none"
                    startAngle={90}
                    endAngle={-270}
                  >
                    {data.sessionsByService.map((row) => (
                      <Cell key={row.service} fill={`var(--color-${row.service})`} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-semibold tracking-tight tabular-nums">
                  {totalSessions}
                </span>
                <span className="text-xs text-muted-foreground">sessions</span>
              </div>
            </div>
            <div className="mt-auto flex flex-col gap-3 pt-4">
              {data.sessionsByService.map((row) => (
                <div key={row.service} className="flex items-center gap-2.5 text-sm">
                  <SvcDot service={row.service} className="size-2.5 rounded-[3px]" />
                  <span className="text-muted-foreground">{SERVICE_LABELS[row.service]}</span>
                  <span className="ml-auto text-muted-foreground tabular-nums">{row.sessions}</span>
                  <span className="w-10 text-right font-medium tabular-nums">
                    {totalSessions ? Math.round((row.sessions / totalSessions) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Attendance</CardTitle>
            <CardDescription>{monthLabel}, all services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              {[
                {
                  value: data.attendance.attendedPct,
                  label: "Attended",
                  className: "text-foreground",
                },
                { value: data.attendance.noShowPct, label: "No-show", className: "text-danger" },
                {
                  value: data.attendance.cancelledPct,
                  label: "Cancelled",
                  className: "text-muted-foreground",
                },
              ].map((item) => (
                <div key={item.label}>
                  <div
                    className={cn(
                      "text-2xl font-semibold tracking-tight tabular-nums",
                      item.className,
                    )}
                  >
                    {item.value}%
                  </div>
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
              <div className="bg-success" style={{ flex: data.attendance.attendedPct }} />
              <div className="bg-danger" style={{ flex: data.attendance.noShowPct }} />
              <div
                className="bg-muted-foreground/30"
                style={{ flex: data.attendance.cancelledPct }}
              />
            </div>
            <Separator className="my-4" />
            <div className="mb-2 text-xs font-medium text-muted-foreground">Frequent no-shows</div>
            {data.frequentNoShows.length ? (
              data.frequentNoShows.map(({ patientId, name, age, service, count }) => {
                return (
                  <Link
                    key={patientId}
                    href={`/patients?patient=${patientId}&tab=sessions`}
                    className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <PatientAvatar name={name} service={service} className="size-7" />
                    <span className="grid leading-tight">
                      <span className="font-medium">{name}</span>
                      <span className="text-xs text-muted-foreground">
                        {age === null ? "Age not recorded" : `${age} years old`}
                      </span>
                    </span>
                    <Badge variant="danger" className="ml-auto">
                      {count} this month
                    </Badge>
                  </Link>
                );
              })
            ) : (
              <p className="text-sm text-muted-foreground">No repeat no-shows this month.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Therapist earnings</CardTitle>
            <CardDescription>{monthLabel}, therapist share by rate class</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {!data.earnings.length && (
              <p className="text-sm text-muted-foreground">No attended sessions yet this month.</p>
            )}
            {data.earnings.map((row) => (
              <div key={row.label} className="grid gap-1.5">
                <div className="flex items-baseline justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <SvcDot service={row.service} />
                    {row.label}
                  </span>
                  <span className="font-medium tabular-nums">{formatPeso(row.amount)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", SERVICE_BG[row.service])}
                    style={{ width: `${(row.amount / maxEarning) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            <div className="mt-1 flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2.5 text-[13px] text-muted-foreground">
              <Info className="size-4 shrink-0" />
              <span>Rates per role live in settings.</span>
              <Button variant="link" size="sm" className="ml-auto h-auto p-0 text-[13px]" asChild>
                <Link href="/settings?tab=rates">Edit rates</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 xl:col-span-1">
          <CardHeader className="flex-row items-start justify-between">
            <div className="grid gap-1">
              <CardTitle>Up next</CardTitle>
              <CardDescription>Today at {branchName}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="-mt-1 -mr-2 text-muted-foreground" asChild>
              <Link href="/schedule">
                View all <ArrowRight />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col">
            {data.upNext.length ? (
              data.upNext.map((appointment) => {
                const { service } = appointment;
                return (
                  <div
                    key={appointment.id}
                    className="flex items-center gap-3 border-b py-2.5 last:border-0"
                  >
                    <div className="w-11 text-xs font-medium text-muted-foreground tabular-nums">
                      {formatManila(new Date(appointment.startsAt), "time").replace(
                        / (AM|PM)$/,
                        "",
                      )}
                    </div>
                    <span className={cn("h-8 w-[3px] rounded-full", SERVICE_BG[service])} />
                    <div className="grid min-w-0 flex-1 leading-tight">
                      <span className="truncate text-sm font-medium">
                        {appointment.patientName}
                        {appointment.age !== null && (
                          <span className="font-normal text-muted-foreground">
                            , {appointment.age}
                          </span>
                        )}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {SERVICE_LABELS[service]} with {appointment.staffName}
                      </span>
                    </div>
                    <StatusBadge status={appointment.status} />
                  </div>
                );
              })
            ) : (
              <EmptyState
                title="Nothing else today"
                description="All of today's sessions are done."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
