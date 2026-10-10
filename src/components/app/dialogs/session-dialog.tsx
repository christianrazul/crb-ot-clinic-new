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
import { toast } from "sonner";
import * as React from "react";

import { useDemoStore } from "@/components/app/demo/demo-store";
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
import type { AppointmentStatus } from "@/lib/appointment-status";
import { APPOINTMENT_STATUS_META } from "@/lib/appointment-status";
import { formatManila } from "@/lib/dates";
import { appointmentService, byId, displayName, paymentFor } from "@/lib/demo/selectors";
import { formatPeso } from "@/lib/money";
import { cn } from "@/lib/utils";

import { useDialogs } from "./dialog-host";

const ACTIONS: { label: string; status: AppointmentStatus; icon: LucideIcon }[] = [
  { label: "Check in", status: "checked_in", icon: LogIn },
  { label: "Mark attended", status: "attended", icon: CircleCheck },
  { label: "No-show", status: "no_show", icon: UserX },
  { label: "Cancel", status: "cancelled", icon: Ban },
];

type Props = { open: boolean; onOpenChange: (open: boolean) => void; appointmentId: string };

/** Session detail for the owner and front desk: status changes, reschedule, patient record. */
export function SessionDialog({ open, onOpenChange, appointmentId }: Props) {
  const { state, dispatch, viewer } = useDemoStore();
  const { openDialog } = useDialogs();
  const [askCancel, setAskCancel] = React.useState(false);

  const appointment = byId(state.appointments, appointmentId);
  const patient = byId(state.patients, appointment?.patientId);
  const staff = byId(state.staff, appointment?.staffId);
  const type = byId(state.sessionTypes, appointment?.sessionTypeId);
  if (!appointment || !patient || !staff || !type) return null;

  const name = displayName(patient);
  const startsAt = new Date(appointment.startsAt);
  const time = formatManila(startsAt, "time");
  const paid = Boolean(paymentFor(state, appointment.id));

  const setStatus = (status: AppointmentStatus) => {
    if (status === "cancelled" && appointment.seriesId) {
      setAskCancel(true);
      return;
    }
    dispatch({
      type: "appointment/setStatus",
      id: appointment.id,
      status,
      byName: viewer.user.name,
    });
    onOpenChange(false);
    toast.success(`${name}: ${APPOINTMENT_STATUS_META[status].label.toLowerCase()}`, {
      description: `${type.name}, ${time}`,
    });
  };

  const cancelOne = () => {
    dispatch({
      type: "appointment/setStatus",
      id: appointment.id,
      status: "cancelled",
      byName: viewer.user.name,
    });
    onOpenChange(false);
    toast.success(`${name}: this session cancelled`);
  };

  const cancelSeries = () => {
    dispatch({ type: "appointment/cancelSeries", id: appointment.id, byName: viewer.user.name });
    onOpenChange(false);
    toast.success(`${name}: weekly booking ended`, {
      description: "This and all future sessions are cancelled.",
    });
  };

  const stamp =
    appointment.statusChangedBy && appointment.statusChangedAt
      ? `Logged by ${appointment.statusChangedBy} at ${formatManila(new Date(appointment.statusChangedAt), "time")}`
      : "Not logged yet";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 pr-6">
            <PatientAvatar
              name={name}
              service={appointmentService(state, appointment)}
              className="size-10"
            />
            <div className="grid gap-0.5">
              <DialogTitle>{name}</DialogTitle>
              <DialogDescription>
                {type.name}, {formatManila(startsAt, "weekdayDate")}
              </DialogDescription>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={appointment.status} />
            <span className="text-xs text-muted-foreground">{stamp}</span>
          </div>
        </DialogHeader>
        <DialogBody className="grid gap-5">
          <InfoGrid
            items={[
              { label: "Time", value: time },
              { label: "Therapist", value: staff.shortName },
              {
                label: "Fee",
                value: <span className="tabular-nums">{formatPeso(appointment.feeCentavos)}</span>,
                sub: paid ? "Paid" : "Payable at the desk",
              },
              { label: "Branch", value: viewer.branchName },
              {
                label: "Guardian",
                value: patient.guardian.name || "Not on file",
                sub: patient.guardian.relationship || undefined,
              },
              {
                label: "Contact",
                value: (
                  <span className="tabular-nums">
                    {patient.guardian.phone || "No number on file"}
                  </span>
                ),
              },
            ]}
          />
          {askCancel ? (
            <div className="animate-in rounded-lg border border-danger/30 bg-danger-soft/60 p-4 fade-in-0">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="size-4 text-danger" /> Cancel a recurring session
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {name} is booked {patient.recurringSlot}. Cancel only this session, or this one and
                every session after it?
              </p>
              <div className="mt-3 grid gap-2">
                <button
                  onClick={cancelOne}
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
                  onClick={cancelSeries}
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
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => setAskCancel(false)}
              >
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
                  const current = appointment.status === status;
                  return (
                    <Button
                      key={status}
                      variant={current ? "default" : "outline"}
                      aria-pressed={current}
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
              <Link href={`/patients?patient=${patient.id}`} onClick={() => onOpenChange(false)}>
                <ExternalLink /> Patient record
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openDialog({ kind: "booking", rescheduleFromId: appointment.id })}
            >
              <CalendarClock /> Reschedule
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
