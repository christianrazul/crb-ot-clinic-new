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
import * as React from "react";
import { toast } from "sonner";

import { setStatusAction } from "@/app/(app)/schedule/actions";
import { EmptyState } from "@/components/app/detail-bits";
import { useDialogs } from "@/components/app/dialogs/dialog-host";
import { Page, PageHeader } from "@/components/app/page-layout";
import { PatientAvatar } from "@/components/app/patient-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatManila } from "@/lib/dates";
import { SERVICE_BG, SERVICE_SHORT } from "@/lib/services";
import { cn } from "@/lib/utils";
import type { TodayPageData } from "@/server/loaders/today-page";

/** The queue shows sessions starting within this window from now. */
const QUEUE_WINDOW_MS = 2 * 60 * 60 * 1000;
const shortTime = (iso: string) => formatManila(new Date(iso), "time").replace(/ (AM|PM)$/, "");

export function TodayScreen({ data, firstName }: { data: TodayPageData; firstName: string }) {
  const { openDialog } = useDialogs();
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const now = new Date(data.nowIso).getTime();
  const staffSurname = new Map(data.staff.map((s) => [s.id, s.surname]));

  const today = data.appointments.filter(
    (a) => a.status !== "cancelled" && a.status !== "rescheduled",
  );
  const queue = today.filter((a) => {
    const start = new Date(a.startsAt).getTime();
    return (
      (a.status === "scheduled" || a.status === "checked_in") &&
      start + 60 * 60 * 1000 > now &&
      start < now + QUEUE_WINDOW_MS
    );
  });
  const waiting = queue.filter((a) => a.status === "scheduled").length;
  const toCollect = today.filter(
    (a) => (a.status === "attended" || a.status === "checked_in") && !a.paid,
  );

  const actions: { icon: LucideIcon; label: string; run: () => void }[] = [
    { icon: UserPlus, label: "New patient", run: () => router.push("/patients") },
    {
      icon: CalendarPlus,
      label: "Walk-in session",
      run: () =>
        openDialog({
          kind: "booking",
          draft: { date: formatManila(new Date(data.nowIso), "isoDate") },
        }),
    },
    { icon: CalendarClock, label: "Reschedule", run: () => router.push("/schedule") },
    { icon: UserX, label: "Mark no-show", run: () => router.push("/schedule") },
  ];

  return (
    <Page>
      <PageHeader
        title={`Good morning, ${firstName}`}
        description={`${today.length} sessions today. ${waiting} waiting to check in, ${toCollect.length} unpaid.`}
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className={cn(pending && "opacity-70")}>
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
              queue.map((a) => {
                const checkedIn = a.status === "checked_in";
                return (
                  <div
                    key={a.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                      checkedIn && "bg-muted/40",
                    )}
                  >
                    <div className="w-12 text-sm font-medium tabular-nums">
                      {shortTime(a.startsAt)}
                    </div>
                    <span className={cn("h-9 w-[3px] rounded-full", SERVICE_BG[a.service])} />
                    <PatientAvatar name={a.patientName} service={a.service} />
                    <div className="grid min-w-0 flex-1 leading-tight">
                      <span className="truncate text-sm font-medium">{a.patientName}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {SERVICE_SHORT[a.service]} with {staffSurname.get(a.staffId)}
                      </span>
                    </div>
                    {checkedIn ? (
                      <Badge variant="success">
                        <Check /> Checked in
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        disabled={pending}
                        aria-label={`Check in ${a.patientName}`}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await setStatusAction(a.id, "checked_in");
                            if (result.ok) toast.success(`${a.patientName} checked in`);
                            else toast.error(result.error);
                          })
                        }
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
                toCollect.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 border-b py-2.5 last:border-0">
                    <PatientAvatar name={a.patientName} service={a.service} className="size-7" />
                    <span className="flex-1 text-sm font-medium">{a.patientName}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`Collect payment from ${a.patientName}`}
                      onClick={() => openDialog({ kind: "payment", appointmentId: a.id })}
                    >
                      <Receipt /> Collect
                    </Button>
                  </div>
                ))
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
