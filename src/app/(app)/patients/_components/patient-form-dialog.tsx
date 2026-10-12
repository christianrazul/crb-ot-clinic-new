"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import * as React from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { SvcDot } from "@/components/app/svc-dot";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { SERVICE_LABELS, type ServiceKey } from "@/lib/services";
import {
  type PatientFormInput,
  type PatientFormValues,
  patientFormSchema,
} from "@/lib/validation/patient";
import type { PatientDetailData } from "@/server/loaders/patients-page";

import { createPatientAction, updatePatientAction } from "../actions";

export type StaffOption = { id: string; displayName: string; service: ServiceKey };

const NONE = "__none";

function defaultsFrom(existing?: PatientDetailData): PatientFormInput {
  const guardian = existing?.guardians[0];
  const p = existing?.patient;
  return {
    firstName: p?.firstName ?? "",
    lastName: p?.lastName ?? "",
    dateOfBirth: p?.dateOfBirth ?? "",
    gender: p?.gender ?? "unspecified",
    diagnosis: p?.diagnosis ?? "",
    service: p?.service ?? "ot",
    enrolledOn: p?.enrolledOn ?? new Date().toISOString().slice(0, 10),
    primaryStaffId: p?.primaryStaffId ?? "",
    backupStaffIds: existing?.backupStaffIds ?? [],
    goalsNotes: p?.goalsNotes ?? "",
    guardianName: guardian?.name ?? "",
    guardianRelationship: guardian?.relationship ?? "",
    guardianPhone: guardian?.phone ?? "",
    guardianEmail: guardian?.email ?? "",
  };
}

/** Create or edit a patient and their primary guardian. Validated here and again on the server. */
export function PatientFormDialog({
  open,
  onOpenChange,
  staffOptions,
  existing,
  onSaved,
  assignedToMe = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffOptions: StaffOption[];
  existing?: PatientDetailData;
  onSaved?: (patientId: string) => void;
  /** A therapist's form: no assignment fields; the server assigns the patient to them. */
  assignedToMe?: boolean;
}) {
  const form = useForm<PatientFormInput, unknown, PatientFormValues>({
    resolver: zodResolver(patientFormSchema),
    defaultValues: defaultsFrom(existing),
  });
  const [serverError, setServerError] = React.useState<string | null>(null);
  const errors = form.formState.errors;
  const primary = useWatch({ control: form.control, name: "primaryStaffId" });

  const submit = form.handleSubmit(async (values) => {
    setServerError(null);
    const name = `${values.firstName} ${values.lastName}`;
    if (existing) {
      const result = await updatePatientAction(existing.patient.id, values);
      if (!result.ok) return setServerError(result.error);
      toast.success(`${name} saved`);
    } else {
      const result = await createPatientAction(values);
      if (!result.ok) return setServerError(result.error);
      toast.success(`${name} added to patients`);
      onSaved?.(result.data.id);
    }
    onOpenChange(false);
  });

  const field = (
    name: keyof PatientFormInput,
    label: string,
    props: React.ComponentProps<typeof Input> = {},
  ) => (
    <div className="grid gap-1.5">
      <Label htmlFor={`pf-${name}`}>{label}</Label>
      <Input
        id={`pf-${name}`}
        aria-invalid={Boolean(errors[name])}
        {...form.register(name)}
        {...props}
      />
      {errors[name] && (
        <p className="text-xs text-danger-strong">{String(errors[name]?.message)}</p>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <form onSubmit={submit} className="flex min-h-0 flex-col" noValidate>
          <DialogHeader>
            <DialogTitle>{existing ? "Edit patient" : "Add patient"}</DialogTitle>
            <DialogDescription>
              {existing
                ? "Changes are saved to the patient record and the audit log."
                : "New patients start as active."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <div className="grid grid-cols-2 gap-3">
              {field("firstName", "First name", {
                autoFocus: true,
                autoComplete: "off",
                placeholder: "Sheldon",
              })}
              {field("lastName", "Last name", { autoComplete: "off", placeholder: "Cooper" })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field("dateOfBirth", "Date of birth", { type: "date" })}
              <div className="grid gap-1.5">
                <Label htmlFor="pf-gender">Gender</Label>
                <Controller
                  control={form.control}
                  name="gender"
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger id="pf-gender">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="unspecified">Not specified</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>
            {field("diagnosis", "Diagnosis", {
              placeholder: "e.g. Sensory processing disorder with fine motor delays",
            })}
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="pf-service">Service</Label>
                <Controller
                  control={form.control}
                  name="service"
                  render={({ field: f }) => (
                    <Select value={f.value} onValueChange={f.onChange}>
                      <SelectTrigger id="pf-service">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(["ot", "speech", "sped"] as const).map((key) => (
                          <SelectItem key={key} value={key}>
                            <span className="flex items-center gap-2">
                              <SvcDot service={key} />
                              {SERVICE_LABELS[key]}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              {field("enrolledOn", "Enrolled on", { type: "date" })}
            </div>
            {assignedToMe ? (
              <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
                {existing
                  ? "The front desk sets who treats this patient."
                  : "This patient will be assigned to you as their primary therapist."}
              </p>
            ) : (
              <>
                <div className="grid gap-1.5">
                  <Label htmlFor="pf-primary">Primary therapist</Label>
                  <Controller
                    control={form.control}
                    name="primaryStaffId"
                    render={({ field: f }) => (
                      <Select
                        value={f.value || NONE}
                        onValueChange={(v) => f.onChange(v === NONE ? "" : v)}
                      >
                        <SelectTrigger id="pf-primary">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>Unassigned</SelectItem>
                          {staffOptions.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              <span className="flex items-center gap-2">
                                <SvcDot service={s.service} />
                                {s.displayName}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <fieldset className="grid gap-2">
                  <legend className="mb-1 text-sm font-medium">Backup therapists</legend>
                  <Controller
                    control={form.control}
                    name="backupStaffIds"
                    render={({ field: f }) => (
                      <div className="grid grid-cols-2 gap-2">
                        {staffOptions
                          .filter((s) => s.id !== primary)
                          .map((s) => {
                            const checked = (f.value ?? []).includes(s.id);
                            return (
                              <label key={s.id} className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(next) =>
                                    f.onChange(
                                      next
                                        ? [...(f.value ?? []), s.id]
                                        : (f.value ?? []).filter((v) => v !== s.id),
                                    )
                                  }
                                />
                                {s.displayName}
                              </label>
                            );
                          })}
                      </div>
                    )}
                  />
                  {errors.backupStaffIds && (
                    <p className="text-xs text-danger-strong">{errors.backupStaffIds.message}</p>
                  )}
                </fieldset>
              </>
            )}
            <div className="grid gap-1.5">
              <Label htmlFor="pf-goals">Goals and notes</Label>
              <Textarea
                id="pf-goals"
                rows={3}
                placeholder="e.g. Tolerate unexpected changes to routine (including a new spot on the couch)"
                {...form.register("goalsNotes")}
              />
            </div>
            <Separator />
            <div className="text-sm font-semibold">Guardian</div>
            <div className="grid grid-cols-2 gap-3">
              {field("guardianName", "Name", { autoComplete: "off", placeholder: "Mary Cooper" })}
              {field("guardianRelationship", "Relationship", { placeholder: "e.g. Mother" })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field("guardianPhone", "Phone", { inputMode: "tel", placeholder: "0917 555 0000" })}
              {field("guardianEmail", "Email", {
                type: "email",
                placeholder: "mary.cooper@example.com",
              })}
            </div>
            {serverError && (
              <p
                role="alert"
                className="rounded-lg border border-danger/30 bg-danger-soft/60 px-3 py-2 text-sm text-danger-strong"
              >
                {serverError}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {existing ? "Save patient" : "Add patient"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
