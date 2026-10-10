"use client";

import { differenceInCalendarDays, parseISO } from "date-fns";
import { Check, NotebookPen } from "lucide-react";
import { Bar, BarChart, XAxis } from "recharts";

import { useDemoStore } from "@/components/app/demo/demo-store";
import { EmptyState } from "@/components/app/detail-bits";
import { useDialogs } from "@/components/app/dialogs/dialog-host";
import { Page, PageHeader } from "@/components/app/page-layout";
import { PatientAvatar } from "@/components/app/patient-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { formatManila, toManilaIsoDate } from "@/lib/dates";
import {
  appointmentService,
  appointmentsOn,
  byId,
  displayName,
  patientAge,
} from "@/lib/demo/selectors";
import { THERAPIST_WEEKLY_EARNINGS } from "@/lib/fixtures/dashboard";
import { DEMO_NOW, DEMO_TODAY } from "@/lib/fixtures/demo-clock";
import { formatPeso } from "@/lib/money";
import { payrollLine } from "@/lib/payroll";
import { SERVICE_BG } from "@/lib/services";
import { cn } from "@/lib/utils";

const earningsConfig = {
  amount: { label: "Earnings", color: "var(--primary)" },
} satisfies ChartConfig;

const shortTime = (iso: string) => formatManila(new Date(iso), "time").replace(/ (AM|PM)$/, "");

/** First clause of the goals, for a one-line focus under the patient's name. */
const focusOf = (goals: string) => goals.split(/[.;]/)[0]!.trim();

export function MyDayScreen() {
  const { state, viewer } = useDemoStore();
  const { openDialog } = useDialogs();
  const staff = byId(state.staff, viewer.staffId);
  const rateClass = byId(state.rateClasses, staff?.rateClassId);

  const mine = appointmentsOn(state, DEMO_TODAY, viewer.branchId).filter(
    (a) => a.staffId === viewer.staffId && a.status !== "cancelled" && a.status !== "rescheduled",
  );
  const hasNote = (appointmentId: string) =>
    state.notes.some((n) => n.appointmentId === appointmentId);

  // Attended sessions without a note. A note is due within 24 hours.
  const notesDue = state.appointments
    .filter(
      (a) =>
        a.staffId === viewer.staffId &&
        a.status === "attended" &&
        new Date(a.endsAt) <= DEMO_NOW &&
        !hasNote(a.id),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const month =
    staff && rateClass
      ? payrollLine(staff.monthSessions, rateClass.rateCentavos, rateClass.therapistSharePct)
      : null;
  const first = mine[0];
  const firstPatient = byId(state.patients, first?.patientId);

  return (
    <Page>
      <PageHeader
        title={`Good morning, ${viewer.user.name.split(" ")[0]}`}
        description={
          first && firstPatient
            ? `${mine.length} sessions today. ${displayName(firstPatient)} is first, at ${shortTime(first.startsAt)}.`
            : "No sessions booked for you today."
        }
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>My sessions today</CardTitle>
            <CardDescription>{formatManila(DEMO_NOW, "weekdayDayLong")}</CardDescription>
          </CardHeader>
          <CardContent className="relative flex flex-col">
            {mine.length ? (
              mine.map((appointment) => {
                const patient = byId(state.patients, appointment.patientId);
                if (!patient) return null;
                const noted = hasNote(appointment.id);
                const name = displayName(patient);
                return (
                  <div
                    key={appointment.id}
                    className="flex items-center gap-3 border-b py-3 last:border-0"
                  >
                    <div className="w-12 text-sm font-medium tabular-nums">
                      {shortTime(appointment.startsAt)}
                    </div>
                    <span
                      className={cn(
                        "h-9 w-[3px] rounded-full",
                        SERVICE_BG[appointmentService(state, appointment)],
                      )}
                    />
                    <div className="grid min-w-0 flex-1 leading-tight">
                      <span className="truncate text-sm font-medium">
                        {name}
                        <span className="font-normal text-muted-foreground">
                          , {patientAge(patient)}
                        </span>
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {focusOf(patient.goalsNotes)}
                      </span>
                    </div>
                    {noted && (
                      <Badge variant="success" className="hidden sm:inline-flex">
                        <Check /> Note saved
                      </Badge>
                    )}
                    <Button
                      size="sm"
                      variant={noted ? "ghost" : "outline"}
                      aria-label={noted ? `Open notes for ${name}` : `Add note for ${name}`}
                      onClick={() => openDialog({ kind: "session", appointmentId: appointment.id })}
                    >
                      <NotebookPen /> {noted ? "Open" : "Add note"}
                    </Button>
                  </div>
                );
              })
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
              <CardDescription>My earnings, August 2026</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-semibold tracking-tight tabular-nums">
                {month ? formatPeso(month.therapistShareCentavos) : formatPeso(0)}
              </div>
              <div className="text-xs text-muted-foreground">
                {staff?.monthSessions ?? 0} sessions at a {rateClass?.therapistSharePct ?? 0}% share
              </div>
              <ChartContainer config={earningsConfig} className="mt-4 aspect-auto h-[110px] w-full">
                <BarChart
                  data={THERAPIST_WEEKLY_EARNINGS}
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
              {notesDue.length ? (
                notesDue.map((appointment) => {
                  const patient = byId(state.patients, appointment.patientId);
                  if (!patient) return null;
                  const name = displayName(patient);
                  const late = differenceInCalendarDays(
                    parseISO(DEMO_TODAY),
                    parseISO(toManilaIsoDate(new Date(appointment.startsAt))),
                  );
                  return (
                    <button
                      key={appointment.id}
                      onClick={() => openDialog({ kind: "session", appointmentId: appointment.id })}
                      className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <PatientAvatar
                        name={name}
                        service={appointmentService(state, appointment)}
                        className="size-7"
                      />
                      <span className="grid flex-1 leading-tight">
                        <span className="text-sm font-medium">{name}</span>
                        <span className="text-xs text-muted-foreground">
                          Session on{" "}
                          {formatManila(new Date(appointment.startsAt), "date").replace(
                            /, \d{4}$/,
                            "",
                          )}
                        </span>
                      </span>
                      <Badge variant={late === 0 ? "warning" : "danger"}>
                        {late === 0 ? "Due today" : `${late} day${late === 1 ? "" : "s"} late`}
                      </Badge>
                    </button>
                  );
                })
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
