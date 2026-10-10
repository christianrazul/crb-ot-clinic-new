"use client";

import { Trash2, UserPlus } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import {
  createPatientAction,
  deletePatientAction,
  setPatientStatusAction,
} from "@/app/(app)/patients/actions";
import { EmptyState } from "@/components/app/detail-bits";
import { SectionHead } from "@/components/app/page-layout";
import { PatientAvatar } from "@/components/app/patient-avatar";
import { SvcDot } from "@/components/app/svc-dot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SERVICE_LABELS } from "@/lib/services";
import { cn } from "@/lib/utils";
import type { SettingsPageData } from "@/server/loaders/settings-page";

import { AddForm } from "./add-form";

const SERVICES = ["ot", "speech", "sped"] as const;

/** Quick add, active switch and remove. The full form lives on the patients page. */
export function PatientsSection({ data }: { data: SettingsPageData }) {
  const [open, setOpen] = React.useState(true);
  const [name, setName] = React.useState("");
  const [service, setService] = React.useState<(typeof SERVICES)[number]>("ot");
  const [pending, startTransition] = React.useTransition();

  const add = () => {
    const trimmed = name.trim();
    const [firstName = "", ...rest] = trimmed.split(/\s+/);
    if (!trimmed) return;
    startTransition(async () => {
      const result = await createPatientAction({
        firstName,
        lastName: rest.join(" ") || "-",
        service,
        enrolledOn: new Date().toISOString().slice(0, 10),
      });
      if (!result.ok) return void toast.error(result.error);
      setName("");
      toast.success(`${trimmed} added to patients`, {
        description: "Fill in their details from the patients page.",
      });
    });
  };

  return (
    <>
      <SectionHead
        title="Patients"
        description="Add patients and switch them between active and inactive."
      >
        {!open && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <UserPlus /> Add patient
          </Button>
        )}
      </SectionHead>
      <Card className={cn("overflow-hidden", pending && "opacity-70")}>
        <AddForm
          open={open}
          submitLabel="Add patient"
          onCancel={() => setOpen(false)}
          onSubmit={add}
        >
          <div className="grid min-w-[200px] flex-1 gap-1.5">
            <Label htmlFor="pt-name">Full name</Label>
            <Input
              id="pt-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Liam Santos"
            />
          </div>
          <div className="grid w-[220px] gap-1.5">
            <Label htmlFor="pt-service">Service</Label>
            <Select value={service} onValueChange={(next) => setService(next as typeof service)}>
              <SelectTrigger id="pt-service">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SERVICES.map((key) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <SvcDot service={key} />
                      {SERVICE_LABELS[key]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </AddForm>
        {data.patients.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Service</TableHead>
                <TableHead className="w-[130px]">Active</TableHead>
                <TableHead className="w-[60px]">
                  <span className="sr-only">Remove</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.patients.map((patient) => {
                const patientName = `${patient.firstName} ${patient.lastName}`;
                const active = patient.status === "active";
                return (
                  <TableRow key={patient.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <PatientAvatar
                          name={patientName}
                          service={patient.service}
                          className="size-7"
                        />
                        <span className={cn("font-medium", !active && "text-muted-foreground")}>
                          {patientName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 whitespace-nowrap text-muted-foreground">
                        <SvcDot service={patient.service} />
                        {SERVICE_LABELS[patient.service]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Switch
                          checked={active}
                          disabled={pending}
                          onCheckedChange={(checked) =>
                            startTransition(async () => {
                              const result = await setPatientStatusAction(
                                patient.id,
                                checked ? "active" : "inactive",
                              );
                              if (!result.ok) toast.error(result.error);
                            })
                          }
                          aria-label={`${patientName} active`}
                        />
                        {active ? "Active" : "Inactive"}
                      </label>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:bg-danger-soft hover:text-danger"
                        aria-label={`Remove ${patientName}`}
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await deletePatientAction(patient.id);
                            if (result.ok)
                              toast.success(`${patientName} removed`, {
                                description: "Their sessions and payments stay on record.",
                              });
                            else toast.error(result.error);
                          })
                        }
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No patients at this branch"
            description="Add the first one with the form above."
          />
        )}
      </Card>
    </>
  );
}
