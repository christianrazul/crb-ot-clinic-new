"use client";

import { format, parseISO } from "date-fns";
import { AlertTriangle, ArrowLeft, CalendarIcon, Clock, Info, Repeat } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { useDemoStore } from "@/components/app/demo/demo-store";
import { SvcDot } from "@/components/app/svc-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bookableHours, eligibleStaff, hourLabel } from "@/lib/booking";
import { formatManila } from "@/lib/dates";
import { validateBooking } from "@/lib/demo/booking";
import { byId, displayName } from "@/lib/demo/selectors";
import { formatPeso } from "@/lib/money";
import type { ServiceKey } from "@/lib/services";
import { cn } from "@/lib/utils";

import { useDialogs } from "./dialog-host";
import { NEW_PATIENT, PatientCombobox } from "./patient-combobox";

export type BookingDraft = {
  sessionTypeId: string;
  patientId: string | null;
  staffId: string | null;
  /** yyyy-MM-dd */
  date: string;
  hour: number;
  recurring: boolean;
};

/** Next open day after the demo date, matching the mockup's default (Monday). */
const DEFAULT_DATE = "2026-08-24";

type BookingDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft?: Partial<BookingDraft>;
  rescheduleFromId?: string;
};

export function BookingDialog({ open, onOpenChange, draft, rescheduleFromId }: BookingDialogProps) {
  const { state, dispatch, viewer } = useDemoStore();
  const { openDialog } = useDialogs();
  const branch = byId(state.branches, viewer.branchId)!;
  const original = byId(state.appointments, rescheduleFromId);
  const rescheduling = Boolean(original);

  const [form, setForm] = React.useState<BookingDraft>({
    sessionTypeId: rescheduling ? "st_makeup" : "st_ot",
    patientId: original?.patientId ?? null,
    staffId: original?.staffId ?? null,
    date: DEFAULT_DATE,
    hour: 9,
    recurring: false,
    ...draft,
  });
  const [selectedPatient, setSelectedPatient] = React.useState<{
    id: string;
    name: string;
    service: ServiceKey;
  } | null>(() => {
    const patient = byId(state.patients, form.patientId);
    return patient
      ? { id: patient.id, name: displayName(patient), service: patient.service }
      : null;
  });
  const [query, setQuery] = React.useState(selectedPatient?.name ?? "");
  const [dateOpen, setDateOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const update = (patch: Partial<BookingDraft>) => {
    setError(null);
    setForm((current) => ({ ...current, ...patch }));
  };

  const sessionTypes = state.sessionTypes.filter((t) => t.active);
  const type = byId(state.sessionTypes, form.sessionTypeId);
  const therapists = eligibleStaff(state.staff, type?.allowedRateClassIds ?? null);
  const isNew = form.patientId === NEW_PATIENT;
  const canSave = Boolean(form.staffId && (isNew ? query.trim() : form.patientId));
  const when = `${format(parseISO(form.date), "EEE, MMM d")}, ${hourLabel(form.hour)}`;

  const save = () => {
    const input = {
      branchId: viewer.branchId,
      patientId: isNew ? null : form.patientId,
      newPatientName: isNew ? query.trim() : undefined,
      staffId: form.staffId ?? "",
      sessionTypeId: form.sessionTypeId,
      date: form.date,
      hour: form.hour,
      recurring: rescheduling ? false : form.recurring,
      rescheduleFromId,
    };
    const problem = validateBooking(state, input);
    if (problem) {
      setError(problem);
      return;
    }
    dispatch({ type: "appointment/book", input });
    const name = isNew ? query.trim() : (selectedPatient?.name ?? "the patient");
    onOpenChange(false);
    if (rescheduling) toast.success(`${name} moved`, { description: `Make up session on ${when}` });
    else
      toast.success(`Session booked for ${name}`, {
        description: when + (form.recurring ? ", repeats weekly" : ""),
      });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {original && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="-ml-2"
                aria-label="Back to session"
                onClick={() => openDialog({ kind: "session", appointmentId: original.id })}
              >
                <ArrowLeft />
              </Button>
            )}
            <DialogTitle>{rescheduling ? "Reschedule session" : "New session"}</DialogTitle>
          </div>
          <DialogDescription>
            {rescheduling
              ? "Booked as a make up session. The original slot is marked as moved."
              : `${branch.name}. One-hour sessions, booked on the hour.`}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          {original && (
            <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-sm">
              <Badge variant="warning">Moving</Badge>
              <span className="truncate text-muted-foreground">
                {byId(state.sessionTypes, original.sessionTypeId)?.name} on{" "}
                {formatManila(new Date(original.startsAt), "shortDay")},{" "}
                {formatManila(new Date(original.startsAt), "time")}
              </span>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="book-type">Session type</Label>
            <Select
              value={form.sessionTypeId}
              onValueChange={(sessionTypeId) => {
                const allowed =
                  byId(state.sessionTypes, sessionTypeId)?.allowedRateClassIds ?? null;
                const keep = therapistsKeep(form.staffId, allowed);
                update({ sessionTypeId, staffId: keep ? form.staffId : null });
              }}
            >
              <SelectTrigger id="book-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sessionTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="flex w-full items-center gap-2">
                      <SvcDot service={t.service} />
                      {t.name}
                      <span className="ml-2 text-muted-foreground tabular-nums">
                        {formatPeso(t.rateCentavos)}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="book-patient">Patient</Label>
            <PatientCombobox
              id="book-patient"
              value={form.patientId}
              selected={selectedPatient}
              query={query}
              onQueryChange={setQuery}
              onPick={(patient) => {
                update({ patientId: patient.id });
                setSelectedPatient(patient);
                setQuery(patient.name);
              }}
              onNew={rescheduling ? undefined : () => update({ patientId: NEW_PATIENT })}
            />
            {isNew && (
              <p className="flex items-center gap-1.5 text-xs text-primary">
                <Info className="size-3.5" />
                New patient. They&apos;ll be added to the roster when you save.
              </p>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="book-staff">Therapist</Label>
            <Select
              value={form.staffId ?? undefined}
              onValueChange={(staffId) => update({ staffId })}
            >
              <SelectTrigger id="book-staff">
                <SelectValue placeholder="Choose a therapist" />
              </SelectTrigger>
              <SelectContent>
                {therapists.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    <span className="flex items-center gap-2">
                      <SvcDot
                        service={byId(state.rateClasses, member.rateClassId)?.service ?? null}
                      />
                      {member.displayName}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="book-date">Date</Label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    id="book-date"
                    variant="outline"
                    className="w-full justify-start px-3 font-normal"
                  >
                    <CalendarIcon className="text-muted-foreground" />
                    <span className="tabular-nums">
                      {format(parseISO(form.date), "EEE, MMM d")}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={parseISO(form.date)}
                    defaultMonth={parseISO(form.date)}
                    onSelect={(date) => {
                      if (!date) return;
                      update({ date: format(date, "yyyy-MM-dd") });
                      setDateOpen(false);
                    }}
                    disabled={(date) => !branch.openDays.includes(date.getDay())}
                    autoFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="book-time">Time</Label>
              <Select
                value={String(form.hour)}
                onValueChange={(hour) => update({ hour: Number(hour) })}
              >
                <SelectTrigger id="book-time" className="justify-start">
                  <Clock className="size-4 shrink-0 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bookableHours(branch.opensAtHour, branch.closesAtHour).map((hour) => (
                    <SelectItem key={hour} value={String(hour)}>
                      {hourLabel(hour)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!rescheduling && (
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors",
                form.recurring ? "border-primary/50 bg-accent/60" : "hover:bg-muted/40",
              )}
            >
              <Checkbox
                checked={form.recurring}
                onCheckedChange={(checked) => update({ recurring: checked === true })}
                className="mt-0.5"
              />
              <span className="grid gap-0.5">
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Repeat className="size-3.5" /> Repeat weekly
                </span>
                <span className="text-xs text-muted-foreground">
                  {form.recurring
                    ? `Every ${format(parseISO(form.date), "EEEE")} at ${hourLabel(form.hour)} until cancelled.`
                    : "A one-off session on the selected date."}
                </span>
              </span>
            </label>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft/60 px-3 py-2.5 text-sm text-danger-strong"
            >
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSave} onClick={save}>
            {rescheduling ? "Confirm reschedule" : "Book session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  function therapistsKeep(staffId: string | null, allowed: string[] | null) {
    const member = byId(state.staff, staffId);
    return Boolean(member && eligibleStaff([member], allowed).length);
  }
}
