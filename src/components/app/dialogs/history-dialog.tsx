"use client";

import { useDemoStore } from "@/components/app/demo/demo-store";
import { InfoGrid } from "@/components/app/detail-bits";
import { PatientAvatar } from "@/components/app/patient-avatar";
import { StatusBadge } from "@/components/app/status-badge";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatManila } from "@/lib/dates";
import { byId, displayName } from "@/lib/demo/selectors";
import { SERVICE_LABELS } from "@/lib/services";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; appointmentId: string };

/** A past session from the patient's Sessions tab, with its latest note. */
export function HistoryDialog({ open, onOpenChange, appointmentId }: Props) {
  const { state, viewer } = useDemoStore();
  const appointment = byId(state.appointments, appointmentId);
  const patient = byId(state.patients, appointment?.patientId);
  const staff = byId(state.staff, appointment?.staffId);
  const type = byId(state.sessionTypes, appointment?.sessionTypeId);
  if (!appointment || !patient || !staff || !type) return null;

  const name = displayName(patient);
  const startsAt = new Date(appointment.startsAt);
  const note = state.notes
    .filter((n) => n.appointmentId === appointment.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const held = appointment.status === "attended" || appointment.status === "checked_in";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 pr-6">
            <PatientAvatar name={name} service={patient.service} className="size-10" />
            <div className="grid gap-0.5">
              <DialogTitle>{name}</DialogTitle>
              <DialogDescription>
                {type.name}, {formatManila(startsAt, "date")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div>
            <StatusBadge status={appointment.status} />
          </div>
          <InfoGrid
            items={[
              { label: "Time", value: formatManila(startsAt, "time") },
              { label: "Therapist", value: staff.shortName },
              { label: "Service", value: SERVICE_LABELS[patient.service] },
              { label: "Branch", value: viewer.branchName },
            ]}
          />
          <div>
            <div className="mb-2 text-sm font-semibold">Session note</div>
            {note ? (
              <div className="rounded-lg border bg-muted/40 p-3.5">
                <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                  {byId(state.staff, note.authorStaffId)?.shortName}
                </div>
                <p className="text-sm leading-relaxed">{note.body}</p>
              </div>
            ) : (
              <p className="rounded-lg border border-dashed p-3.5 text-sm text-muted-foreground">
                {held
                  ? "No note yet. The therapist adds it from My day."
                  : "No note. This session was not held."}
              </p>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
