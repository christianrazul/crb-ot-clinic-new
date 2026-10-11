"use client";

import { Check, NotebookPen } from "lucide-react";
import { Bar, BarChart, XAxis } from "recharts";

import { EmptyState } from "@/components/app/detail-bits";
import { useDialogs } from "@/components/app/dialogs/dialog-host";
import { Page, PageHeader } from "@/components/app/page-layout";
import { PatientAvatar } from "@/components/app/patient-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { formatManila } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { SERVICE_BG } from "@/lib/services";
import { cn } from "@/lib/utils";
import type { MyDayData } from "@/server/services/notes";

const earningsConfig = {
  amount: { label: "Earnings", color: "var(--primary)" },
} satisfies ChartConfig;
const shortTime = (iso: string) => formatManila(new Date(iso), "time").replace(/ (AM|PM)$/, "");

export function MyDayScreen({ data, firstName }: { data: MyDayData; firstName: string }) {
  const { openDialog } = useDialogs();
  const first = data.sessions[0];
  const todayLabel = formatManila(new Date(`${data.today}T04:00:00Z`), "weekdayDayLong");

  return (
    <Page>
      <PageHeader
        title={`Good morning, ${firstName}`}
        description={
          first
            ? `${data.sessions.length} sessions today. ${first.patientName} is first, at ${shortTime(first.startsAt)}.`
            : "No sessions booked for you today."
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>My sessions today</CardTitle>
            <CardDescription>{todayLabel}</CardDescription>
          </CardHeader>
          <CardContent className="relative flex flex-col">
            {data.sessions.length ? (
              data.sessions.map((s) => (
                <div key={s.id} className="flex items-center gap-3 border-b py-3 last:border-0">
                  <div className="w-12 text-sm font-medium tabular-nums">
                    {shortTime(s.startsAt)}
                  </div>
                  <span className={cn("h-9 w-[3px] rounded-full", SERVICE_BG[s.service])} />
                  <div className="grid min-w-0 flex-1 leading-tight">
                    <span className="truncate text-sm font-medium">
                      {s.patientName}
                      {s.age !== null && (
                        <span className="font-normal text-muted-foreground">, {s.age}</span>
                      )}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{s.focus}</span>
                  </div>
                  {s.noted && (
                    <Badge variant="success" className="hidden sm:inline-flex">
                      <Check /> Note saved
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant={s.noted ? "ghost" : "outline"}
                    aria-label={
                      s.noted ? `Open notes for ${s.patientName}` : `Add note for ${s.patientName}`
                    }
                    onClick={() => openDialog({ kind: "session", appointmentId: s.id })}
                  >
                    <NotebookPen /> {s.noted ? "Open" : "Add note"}
                  </Button>
                </div>
              ))
            ) : (
              <EmptyState
                title="No sessions today"
                description="Your booked sessions show here each morning."
              />
            )}
          </CardContent>
        </Card>
        <div className="grid gap-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>My earnings, {data.earnings.monthLabel}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tracking-tight tabular-nums">
                {formatPeso(data.earnings.totalCentavos)}
              </div>
              <div className="text-xs text-muted-foreground">
                {data.earnings.sessions} sessions at a {data.earnings.sharePct}% share
              </div>
              <ChartContainer config={earningsConfig} className="mt-4 aspect-auto h-[110px] w-full">
                <BarChart
                  data={data.earnings.weekly}
                  margin={{ left: 0, right: 0, top: 4, bottom: 0 }}
                  accessibilityLayer
                >
                  <XAxis dataKey="week" tickLine={false} axisLine={false} fontSize={11} />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)" }}
                    content={({ active, payload, label }) =>
                      active && payload?.length ? (
                        <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
                          <span className="text-muted-foreground">{label} </span>
                          <span className="font-medium tabular-nums">
                            {formatPeso(Number(payload[0]!.value))}
                          </span>
                        </div>
                      ) : null
                    }
                  />
                  <Bar
                    dataKey="amount"
                    radius={[4, 4, 0, 0]}
                    barSize={22}
                    fill="var(--color-amount)"
                    fillOpacity={0.85}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Notes due</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col">
              {data.notesDue.length ? (
                data.notesDue.map((n) => (
                  <button
                    key={n.appointmentId}
                    onClick={() => openDialog({ kind: "session", appointmentId: n.appointmentId })}
                    className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <PatientAvatar name={n.patientName} service={n.service} className="size-7" />
                    <span className="grid flex-1 leading-tight">
                      <span className="text-sm font-medium">{n.patientName}</span>
                      <span className="text-xs text-muted-foreground">
                        Session on{" "}
                        {formatManila(new Date(n.startsAt), "date").replace(/, \d{4}$/, "")}
                      </span>
                    </span>
                    <Badge variant={n.daysLate === 0 ? "warning" : "danger"}>
                      {n.daysLate === 0
                        ? "Due today"
                        : `${n.daysLate} day${n.daysLate === 1 ? "" : "s"} late`}
                    </Badge>
                  </button>
                ))
              ) : (
                <EmptyState title="All notes are up to date" className="py-6" />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Page>
  );
}
