"use client";

import {
  Ban,
  CalendarClock,
  Check,
  CircleCheck,
  LogIn,
  type LucideIcon,
  NotebookPen,
  Pencil,
  UserX,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { addNoteAction, editNoteAction, getNoteContextAction } from "@/app/(app)/my-day/actions";
import {
  cancelSeriesAction,
  getAppointmentAction,
  setStatusAction,
} from "@/app/(app)/schedule/actions";
import { InfoGrid } from "@/components/app/detail-bits";
import { PatientAvatar } from "@/components/app/patient-avatar";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { APPOINTMENT_STATUS_META, type AppointmentStatus } from "@/lib/appointment-status";
import { formatManila } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { NoteContext } from "@/server/services/notes";

import { useDialogs } from "./dialog-host";
import { useServerData } from "./use-server-data";

const ACTIONS: { label: string; status: AppointmentStatus; icon: LucideIcon }[] = [
  { label: "Check in", status: "checked_in", icon: LogIn },
  { label: "Mark attended", status: "attended", icon: CircleCheck },
  { label: "No-show", status: "no_show", icon: UserX },
  { label: "Cancel", status: "cancelled", icon: Ban },
];

type Props = { open: boolean; onOpenChange: (open: boolean) => void; appointmentId: string };

/** The therapist's view of a session: context, a note form, and the two latest notes. */
export function SessionNoteDialog({ open, onOpenChange, appointmentId }: Props) {
  const loaded = useServerData(() => getNoteContextAction(appointmentId));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        {loaded.data ? (
          <NoteBody initial={loaded.data} onOpenChange={onOpenChange} />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Session note</DialogTitle>
              <DialogDescription>{loaded.error ?? "Loading the session…"}</DialogDescription>
            </DialogHeader>
            {!loaded.error && (
              <DialogBody>
                <Skeleton className="h-48" />
              </DialogBody>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function NoteBody({
  initial,
  onOpenChange,
}: {
  initial: NoteContext;
  onOpenChange: (open: boolean) => void;
}) {
  const { openDialog } = useDialogs();
  const [askCancel, setAskCancel] = React.useState(false);
  const [context, setContext] = React.useState(initial);
  const [draft, setDraft] = React.useState("");
  const [editing, setEditing] = React.useState<{ id: string; body: string } | null>(null);
  const [justSaved, setJustSaved] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const startsAt = new Date(context.startsAt);
  const canNote =
    context.canWrite && (context.status === "attended" || context.status === "checked_in");

  const upcoming = context.status === "scheduled" || context.status === "checked_in";
  const moved = context.status === "rescheduled";
  const firstName = context.patient.name.split(" ")[0];

  const setStatus = (status: AppointmentStatus) => {
    if (status === "cancelled" && context.recurring) return setAskCancel(true);
    startTransition(async () => {
      const result = await setStatusAction(context.appointmentId, status);
      if (!result.ok) return void toast.error(result.error ?? "That didn't work. Try again.");
      setContext((c) => ({ ...c, status: result.data.status }));
      setAskCancel(false);
      toast.success(
        `${context.patient.name}: ${APPOINTMENT_STATUS_META[status].label.toLowerCase()}`,
      );
    });
  };

  const cancelSeries = () =>
    startTransition(async () => {
      const result = await cancelSeriesAction(context.appointmentId);
      if (!result.ok) return void toast.error(result.error ?? "That didn't work. Try again.");
      onOpenChange(false);
      toast.success(`${context.patient.name}: weekly booking ended`, {
        description: "This and all future sessions are cancelled.",
      });
    });

  const reschedule = () =>
    startTransition(async () => {
      const result = await getAppointmentAction(context.appointmentId);
      if (!result.ok) return void toast.error(result.error ?? "That didn't work. Try again.");
      openDialog({ kind: "booking", reschedule: result.data });
    });

  const save = () =>
    startTransition(async () => {
      const result = editing
        ? await editNoteAction(editing.id, context.appointmentId, editing.body)
        : await addNoteAction(context.appointmentId, draft);
      if (!result.ok) return void toast.error(result.error);
      setContext(result.data);
      setDraft("");
      setEditing(null);
      setJustSaved(true);
      toast.success(editing ? "Session note updated" : "Session note saved", {
        description: context.patient.name,
      });
    });

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-3 pr-6">
          <PatientAvatar
            name={context.patient.name}
            service={context.service}
            className="size-10"
          />
          <div className="grid gap-0.5">
            <DialogTitle>{context.patient.name}</DialogTitle>
            <DialogDescription>
              {context.patient.age === null ? "Age not recorded" : `${context.patient.age} yrs`},{" "}
              {context.patient.diagnosis || "No diagnosis on file"}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>
      <DialogBody className="grid gap-5">
        <InfoGrid
          items={[
            { label: "Session", value: context.sessionTypeName },
            {
              label: "When",
              value: `${formatManila(startsAt, "shortDay")}, ${formatManila(startsAt, "time")}`,
            },
            { label: "Recurring slot", value: context.patient.recurringSlot },
            {
              label: "To date",
              value: `${context.sessionsToDate} sessions, ${context.attendancePct ?? 0}% attended`,
            },
          ]}
        />
        <div>
          <div className="mb-1.5 text-sm font-semibold">Goals and focus</div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {context.patient.goals || "No goals recorded yet."}
          </p>
        </div>
        {context.canChangeStatus && !moved && (
          <div className="grid gap-2">
            <Label id="update-status-label">Update status</Label>
            {askCancel ? (
              <div className="rounded-lg border border-danger/30 bg-danger-soft/60 p-3.5">
                <p className="text-sm text-muted-foreground">
                  {firstName} is booked {context.patient.recurringSlot}. Cancel only this session,
                  or this one and every session after it?
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => {
                      setAskCancel(false);
                      startTransition(async () => {
                        const result = await setStatusAction(context.appointmentId, "cancelled");
                        if (!result.ok)
                          return void toast.error(result.error ?? "That didn't work. Try again.");
                        setContext((c) => ({ ...c, status: result.data.status }));
                        toast.success(`${context.patient.name}: this session cancelled`);
                      });
                    }}
                  >
                    This session only
                  </Button>
                  <Button size="sm" variant="outline" disabled={pending} onClick={cancelSeries}>
                    This and all future sessions
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAskCancel(false)}>
                    Keep session
                  </Button>
                </div>
              </div>
            ) : (
              <div
                role="group"
                aria-labelledby="update-status-label"
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              >
                {ACTIONS.map(({ label, status, icon: Icon }) => {
                  const current = context.status === status;
                  return (
                    <Button
                      key={status}
                      variant={current ? "default" : "outline"}
                      aria-pressed={current}
                      disabled={pending}
                      className="h-auto flex-col gap-1.5 py-2.5 text-xs"
                      onClick={() => setStatus(status)}
                    >
                      {current ? <Check /> : <Icon />}
                      {label}
                    </Button>
                  );
                })}
              </div>
            )}
            {upcoming && !askCancel && (
              <Button
                size="sm"
                variant="outline"
                className="justify-self-start"
                disabled={pending}
                onClick={reschedule}
              >
                <CalendarClock /> Reschedule
              </Button>
            )}
          </div>
        )}
        {moved && (
          <p className="rounded-lg border border-dashed p-3.5 text-sm text-muted-foreground">
            This session was moved to a make up session.
          </p>
        )}
        {canNote ? (
          <div className="grid gap-2">
            <Label htmlFor="note" className="flex items-center gap-2">
              <NotebookPen className="size-4 text-primary" />{" "}
              {editing ? "Edit your note" : "Add a session note"}
            </Label>
            <Textarea
              id="note"
              rows={4}
              value={editing ? editing.body : draft}
              onChange={(event) =>
                editing
                  ? setEditing({ ...editing, body: event.target.value })
                  : setDraft(event.target.value)
              }
              placeholder="What you worked on, how the child responded, next steps"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {editing
                  ? "Saving keeps the earlier version on record."
                  : "Visible to the clinic admin and front desk."}
              </span>
              <div className="flex gap-2">
                {editing && (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Cancel edit
                  </Button>
                )}
                <Button
                  size="sm"
                  disabled={pending || !(editing ? editing.body.trim() : draft.trim())}
                  onClick={save}
                >
                  {editing ? "Save changes" : "Save note"}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          context.canWrite && (
            <p className="rounded-lg border border-dashed p-3.5 text-sm text-muted-foreground">
              You can add a note once {firstName} is checked in.
            </p>
          )
        )}
        <div>
          <div className="mb-2 text-sm font-semibold">Recent notes</div>
          {context.notes.length ? (
            <ol className="relative grid gap-4 border-l pl-5">
              {context.notes.map((note, index) => (
                <li key={note.id} className="relative">
                  <span
                    className={cn(
                      "absolute top-1 -left-[25px] size-2.5 rounded-full border-2 border-background",
                      index === 0 && justSaved ? "bg-primary" : "bg-muted-foreground/40",
                    )}
                  />
                  <div className="flex items-baseline gap-2 text-xs">
                    <span className="font-medium tabular-nums">
                      {formatManila(new Date(note.createdAt), "date")}
                    </span>
                    <span className="text-muted-foreground">{note.authorName}</span>
                    {note.version > 1 && (
                      <Badge variant="muted" className="px-1.5 py-0 text-[10.5px]">
                        Edited
                      </Badge>
                    )}
                    {context.canWrite && note.authorStaffId === context.myStaffId && !editing && (
                      <Button
                        variant="link"
                        size="sm"
                        className="ml-auto h-auto p-0 text-xs"
                        onClick={() => setEditing({ id: note.id, body: note.body })}
                      >
                        <Pencil className="size-3!" /> Edit
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{note.body}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-lg border border-dashed p-3.5 text-sm text-muted-foreground">
              No notes for {context.patient.name.split(" ")[0]} yet. The first one you save shows
              here.
            </p>
          )}
        </div>
      </DialogBody>
    </>
  );
}
