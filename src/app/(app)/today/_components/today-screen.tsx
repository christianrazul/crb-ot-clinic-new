"use client";

import {
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  Check,
  type LucideIcon,
  Receipt,
  UserPlus,
  UserX,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useDemoStore } from "@/components/app/demo/demo-store";
import { EmptyState } from "@/components/app/detail-bits";
import { useDialogs } from "@/components/app/dialogs/dialog-host";
import { Page, PageHeader } from "@/components/app/page-layout";
import { PatientAvatar } from "@/components/app/patient-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatManila } from "@/lib/dates";
import {
  appointmentService,
  appointmentsOn,
  byId,
  displayName,
  paymentFor,
} from "@/lib/demo/selectors";
import { DEMO_NOW, DEMO_TODAY } from "@/lib/fixtures/demo-clock";
import { formatPeso } from "@/lib/money";
import { SERVICE_BG, SERVICE_SHORT } from "@/lib/services";
import { cn } from "@/lib/utils";

/** The queue shows sessions starting within this window from now. */
const QUEUE_WINDOW_MS = 2 * 60 * 60 * 1000;

const shortTime = (iso: string) => formatManila(new Date(iso), "time").replace(/ (AM|PM)$/, "");

export function TodayScreen() {
  const { state, dispatch, viewer } = useDemoStore();
  const { openDialog } = useDialogs();
  const router = useRouter();

  const today = appointmentsOn(state, DEMO_TODAY, viewer.branchId).filter(
    (a) => a.status !== "cancelled" && a.status !== "rescheduled",
  );
  const queue = today.filter(
    (a) =>
      (a.status === "scheduled" || a.status === "checked_in") &&
      new Date(a.endsAt) > DEMO_NOW &&
      new Date(a.startsAt).getTime() < DEMO_NOW.getTime() + QUEUE_WINDOW_MS,
  );
  const waiting = queue.filter((a) => a.status === "scheduled").length;
  const toCollect = today.filter(
    (a) => (a.status === "attended" || a.status === "checked_in") && !paymentFor(state, a.id),
  );

  const actions: { icon: LucideIcon; label: string; run: () => void }[] = [
    { icon: UserPlus, label: "New patient", run: () => router.push("/settings?tab=patients") },
    {
      icon: CalendarPlus,
      label: "Walk-in session",
      run: () => openDialog({ kind: "booking", draft: { date: DEMO_TODAY, hour: 11 } }),
    },
    { icon: CalendarClock, label: "Reschedule", run: () => router.push("/schedule") },
    { icon: UserX, label: "Mark no-show", run: () => router.push("/schedule") },
  ];

  return (
    <Page>
      <PageHeader
        title={`Good morning, ${viewer.user.name.split(" ")[0]}`}
        description={`${today.length} sessions today. ${waiting} waiting to check in, ${toCollect.length} unpaid.`}
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div className="grid gap-1">
              <CardTitle>Check-in queue</CardTitle>
              <CardDescription>Next arrivals</CardDescription>
            </div>
            <Badge variant="secondary" className="tabular-nums">
              {queue.length - waiting} of {queue.length} in
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {queue.length ? (
              queue.map((appointment) => {
                const patient = byId(state.patients, appointment.patientId);
                const staff = byId(state.staff, appointment.staffId);
                if (!patient || !staff) return null;
                const name = displayName(patient);
                const service = appointmentService(state, appointment);
                const checkedIn = appointment.status === "checked_in";
                return (
                  <div
                    key={appointment.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                      checkedIn && "bg-muted/40",
                    )}
                  >
                    <div className="w-12 text-sm font-medium tabular-nums">
                      {shortTime(appointment.startsAt)}
                    </div>
                    <span className={cn("h-9 w-[3px] rounded-full", SERVICE_BG[service])} />
                    <PatientAvatar name={name} service={service} />
                    <div className="grid min-w-0 flex-1 leading-tight">
                      <span className="truncate text-sm font-medium">{name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {SERVICE_SHORT[service]} with {staff.surname}
                      </span>
                    </div>
                    {checkedIn ? (
                      <Badge variant="success">
                        <Check /> Checked in
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        aria-label={`Check in ${name}`}
                        onClick={() => {
                          dispatch({
                            type: "appointment/setStatus",
                            id: appointment.id,
                            status: "checked_in",
                            byName: viewer.user.name,
                          });
                          toast.success(`${name} checked in`);
                        }}
                      >
                        Check in
                      </Button>
                    )}
                  </div>
                );
              })
            ) : (
              <EmptyState
                title="Nobody is due in the next two hours"
                description="Later arrivals show here as their time comes."
              />
            )}
          </CardContent>
        </Card>
        <div className="grid gap-5">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Collect payments</CardTitle>
              <Button variant="ghost" size="sm" className="-mr-2 text-muted-foreground" asChild>
                <Link href="/billing">
                  Billing <ArrowRight />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col">
              {toCollect.length ? (
                toCollect.map((appointment) => {
                  const patient = byId(state.patients, appointment.patientId);
                  if (!patient) return null;
                  const name = displayName(patient);
                  return (
                    <div
                      key={appointment.id}
                      className="flex items-center gap-3 border-b py-2.5 last:border-0"
                    >
                      <PatientAvatar
                        name={name}
                        service={appointmentService(state, appointment)}
                        className="size-7"
                      />
                      <span className="flex-1 text-sm font-medium">{name}</span>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatPeso(appointment.feeCentavos)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Collect payment from ${name}`}
                        onClick={() =>
                          openDialog({ kind: "payment", appointmentId: appointment.id })
                        }
                      >
                        <Receipt /> Collect
                      </Button>
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  title="All settled"
                  description="Sessions that still need payment show here."
                  className="py-6"
                />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              {actions.map(({ icon: Icon, label, run }) => (
                <Button
                  key={label}
                  variant="outline"
                  className="h-auto flex-col items-start gap-2 p-3 text-left"
                  onClick={run}
                >
                  <span className="flex size-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <Icon />
                  </span>
                  <span className="text-[13px]">{label}</span>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </Page>
  );
}
