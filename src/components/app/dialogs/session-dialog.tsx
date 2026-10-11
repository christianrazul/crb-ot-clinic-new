"use client";

import {
  AlertTriangle,
  ArrowRight,
  Ban,
  CalendarClock,
  Check,
  CircleCheck,
  ExternalLink,
  LogIn,
  type LucideIcon,
  UserX,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import {
  cancelSeriesAction,
  getAppointmentAction,
  setStatusAction,
} from "@/app/(app)/schedule/actions";
import { InfoGrid } from "@/components/app/detail-bits";
import { PatientAvatar } from "@/components/app/patient-avatar";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { APPOINTMENT_STATUS_META, type AppointmentStatus } from "@/lib/appointment-status";
import { formatManila } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { AppointmentDetail } from "@/server/services/scheduling";

import { useDialogs } from "./dialog-host";
import { useServerData } from "./use-server-data";

const ACTIONS: { label: string; status: AppointmentStatus; icon: LucideIcon }[] = [
  { label: "Check in", status: "checked_in", icon: LogIn },
  { label: "Mark attended", status: "attended", icon: CircleCheck },
  { label: "No-show", status: "no_show", icon: UserX },
  { label: "Cancel", status: "cancelled", icon: Ban },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: string;
  branchName: string;
};

/** Session detail for the owner and front desk: status changes, reschedule, patient record. */
export function SessionDialog({ open, onOpenChange, appointmentId, branchName }: Props) {
  const loaded = useServerData(() => getAppointmentAction(appointmentId));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {loaded.data ? (
          <SessionBody detail={loaded.data} onOpenChange={onOpenChange} branchName={branchName} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Session</DialogTitle>
              <DialogDescription>{loaded.error ?? "Loading the session…"}</DialogDescription>
            </DialogHeader>
            {!loaded.error && (
              <DialogBody>
                <Skeleton className="h-40" />
              </DialogBody>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SessionBody({
  detail,
  onOpenChange,
  branchName,
}: {
  detail: AppointmentDetail;
  onOpenChange: (open: boolean) => void;
  branchName: string;
}) {
  const { openDialog } = useDialogs();
  const [askCancel, setAskCancel] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const startsAt = new Date(detail.startsAt);
  const time = formatManila(startsAt, "time");
  const name = detail.patient.name;
  const moved = detail.status === "rescheduled";

  const run = (work: () => Promise<{ ok: boolean; error?: string }>, success: () => void) =>
    startTransition(async () => {
      const result = await work();
      if (!result.ok) return void toast.error(result.error ?? "That didn't work. Try again.");
      onOpenChange(false);
      success();
    });

  const setStatus = (status: AppointmentStatus) => {
    if (status === "cancelled" && detail.recurring) return setAskCancel(true);
    run(
      () => setStatusAction(detail.id, status),
      () =>
        toast.success(`${name}: ${APPOINTMENT_STATUS_META[status].label.toLowerCase()}`, {
          description: `${detail.sessionTypeName}, ${time}`,
        }),
    );
  };

  const stamp =
    detail.statusChangedBy && detail.statusChangedAt
      ? `Logged by ${detail.statusChangedBy} at ${formatManila(new Date(detail.statusChangedAt), "time")}`
      : "Not logged yet";

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3 pr-6">
          <PatientAvatar name={name} service={detail.service} className="size-10" />
          <div className="grid gap-0.5">
            <DialogTitle>{name}</DialogTitle>
            <DialogDescription>
              {detail.sessionTypeName}, {formatManila(startsAt, "weekdayDate")}
            </DialogDescription>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <StatusBadge status={detail.status} />
          <span className="text-xs text-muted-foreground">{stamp}</span>
        </div>
      </DialogHeader>
      <DialogBody className={cn("grid gap-5", pending && "opacity-70")}>
        <InfoGrid
          items={[
            { label: "Time", value: time },
            { label: "Therapist", value: detail.staffName },
            {
              label: "Fee",
              value: <span className="tabular-nums">{formatPeso(detail.feeCentavos ?? 0)}</span>,
              sub: detail.paid ? "Paid" : "Payable at the desk",
            },
            { label: "Branch", value: branchName },
            {
              label: "Guardian",
              value: detail.guardian?.name || "Not on file",
              sub: detail.guardian?.relationship || undefined,
            },
            {
              label: "Contact",
              value: (
                <span className="tabular-nums">
                  {detail.guardian?.phone || "No number on file"}
                </span>
              ),
            },
          ]}
        />
        {moved ? (
          <p className="rounded-lg border border-dashed p-3.5 text-sm text-muted-foreground">
            This session was moved to a make up session.
          </p>
        ) : askCancel ? (
          <div className="animate-in rounded-lg border border-danger/30 bg-danger-soft/60 p-4 fade-in-0">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4 text-danger" /> Cancel a recurring session
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {name} is booked {detail.patient.recurringSlot}. Cancel only this session, or this one
              and every session after it?
            </p>
            <div className="mt-3 grid gap-2">
              <button
                disabled={pending}
                onClick={() =>
                  run(
                    () => setStatusAction(detail.id, "cancelled"),
                    () => toast.success(`${name}: this session cancelled`),
                  )
                }
                className="flex items-center justify-between rounded-md border bg-background px-3 py-2.5 text-left text-sm transition-colors hover:border-foreground/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span>
                  <span className="font-medium">This session only</span>
                  <span className="block text-xs text-muted-foreground">
                    {formatManila(startsAt, "weekdayDay")}
                  </span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground" />
              </button>
              <button
                disabled={pending}
                onClick={() =>
                  run(
                    () => cancelSeriesAction(detail.id),
                    () =>
                      toast.success(`${name}: weekly booking ended`, {
                        description: "This and all future sessions are cancelled.",
                      }),
                  )
                }
                className="flex items-center justify-between rounded-md border bg-background px-3 py-2.5 text-left text-sm transition-colors hover:border-danger/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <span>
                  <span className="font-medium text-danger">This and all future sessions</span>
                  <span className="block text-xs text-muted-foreground">
                    Ends the weekly booking
                  </span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground" />
              </button>
            </div>
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAskCancel(false)}>
              Keep session
            </Button>
          </div>
        ) : (
          <div className="grid gap-2">
            <Label id="update-status-label">Update status</Label>
            <div
              role="group"
              aria-labelledby="update-status-label"
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {ACTIONS.map(({ label, status, icon: Icon }) => {
                const current = detail.status === status;
                return (
                  <Button
                    key={status}
                    variant={current ? "default" : "outline"}
                    aria-pressed={current}
                    disabled={pending}
                    className={cn(
                      "h-auto flex-col gap-1.5 py-2.5 text-xs",
                      status === "no_show" &&
                        !current &&
                        "hover:border-danger/40 hover:text-danger",
                    )}
                    onClick={() => setStatus(status)}
                  >
                    {current ? <Check /> : <Icon />}
                    {label}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </DialogBody>
      {!askCancel && (
        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={`/patients?patient=${detail.patient.id}`}
              onClick={() => onOpenChange(false)}
            >
              <ExternalLink /> Patient record
            </Link>
          </Button>
          {!moved && (detail.status === "scheduled" || detail.status === "checked_in") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => openDialog({ kind: "booking", reschedule: detail })}
            >
              <CalendarClock /> Reschedule
            </Button>
          )}
        </DialogFooter>
      )}
    </>
  );
}
