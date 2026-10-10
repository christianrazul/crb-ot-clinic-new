"use client";

import { NotebookPen } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { useDemoStore } from "@/components/app/demo/demo-store";
import { InfoGrid } from "@/components/app/detail-bits";
import { PatientAvatar } from "@/components/app/patient-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatManila } from "@/lib/dates";
import { appointmentService, byId, displayName, patientAge } from "@/lib/demo/selectors";
import { cn } from "@/lib/utils";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; appointmentId: string };

/** The therapist's view of a session: context, a note form and earlier notes. */
export function SessionNoteDialog({ open, onOpenChange, appointmentId }: Props) {
  const { state, dispatch, viewer } = useDemoStore();
  const [draft, setDraft] = React.useState("");
  const [savedThisTime, setSavedThisTime] = React.useState(false);

  const appointment = byId(state.appointments, appointmentId);
  const patient = byId(state.patients, appointment?.patientId);
  const type = byId(state.sessionTypes, appointment?.sessionTypeId);
  if (!appointment || !patient || !type) return null;

  const name = displayName(patient);
  const startsAt = new Date(appointment.startsAt);
  const held = state.appointments.filter(
    (a) => a.patientId === patient.id && a.startsAt <= appointment.startsAt,
  );
  const attended = held.filter((a) => a.status === "attended").length;
  const notes = state.notes
    .filter((n) => n.patientId === patient.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    // The two most recent, as in the mockup; the full history is on the patient record.
    .slice(0, 2);

  const save = () => {
    if (!draft.trim() || !viewer.staffId) return;
    dispatch({
      type: "note/add",
      appointmentId: appointment.id,
      body: draft,
      authorStaffId: viewer.staffId,
    });
    setDraft("");
    setSavedThisTime(true);
    toast.success("Session note saved", { description: name });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
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
                {patientAge(patient)} yrs, {patient.diagnosis || "No diagnosis on file"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogBody className="grid gap-5">
          <InfoGrid
            items={[
              { label: "Session", value: type.name },
              {
                label: "When",
                value: `${formatManila(startsAt, "shortDay")}, ${formatManila(startsAt, "time")}`,
              },
              { label: "Recurring slot", value: patient.recurringSlot },
              {
                label: "To date",
                value: `${held.length} sessions, ${held.length ? Math.round((attended / held.length) * 100) : 0}% attended`,
              },
            ]}
          />
          <div>
            <div className="mb-1.5 text-sm font-semibold">Goals and focus</div>
            <p className="text-sm leading-relaxed text-muted-foreground">{patient.goalsNotes}</p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="note" className="flex items-center gap-2">
              <NotebookPen className="size-4 text-primary" /> Add a session note
            </Label>
            <Textarea
              id="note"
              rows={4}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="What you worked on, how the child responded, next steps"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                Visible to the clinic admin and front desk.
              </span>
              <Button size="sm" disabled={!draft.trim()} onClick={save}>
                Save note
              </Button>
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold">Recent notes</div>
            {notes.length ? (
              <ol className="relative grid gap-4 border-l pl-5">
                {notes.map((note, index) => (
                  <li key={note.id} className="relative">
                    <span
                      className={cn(
                        "absolute top-1 -left-[25px] size-2.5 rounded-full border-2 border-background",
                        index === 0 && savedThisTime ? "bg-primary" : "bg-muted-foreground/40",
                      )}
                    />
                    <div className="flex items-baseline gap-2 text-xs">
                      <span className="font-medium tabular-nums">
                        {formatManila(new Date(note.createdAt), "date")}
                      </span>
                      <span className="text-muted-foreground">
                        {byId(state.staff, note.authorStaffId)?.shortName}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {note.body}
                    </p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-lg border border-dashed p-3.5 text-sm text-muted-foreground">
                No notes for {patient.firstName} yet. The first one you save shows here.
              </p>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
