"use client";

import { getHistoryDetailAction } from "@/app/(app)/my-day/actions";
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatManila } from "@/lib/dates";
import { SERVICE_LABELS } from "@/lib/services";

import { useServerData } from "./use-server-data";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; appointmentId: string };

/** A past session from the patient's Sessions tab, with its latest note. */
export function HistoryDialog({ open, onOpenChange, appointmentId }: Props) {
  const { data, error } = useServerData(() => getHistoryDetailAction(appointmentId));
  const held = data?.status === "attended" || data?.status === "checked_in";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {data ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3 pr-6">
                <PatientAvatar
                  name={data.patient.name}
                  service={data.patient.service}
                  className="size-10"
                />
                <div className="grid gap-0.5">
                  <DialogTitle>{data.patient.name}</DialogTitle>
                  <DialogDescription>
                    {data.sessionTypeName}, {formatManila(new Date(data.startsAt), "date")}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <DialogBody className="grid gap-4">
              <div>
                <StatusBadge status={data.status} />
              </div>
              <InfoGrid
                items={[
                  { label: "Time", value: formatManila(new Date(data.startsAt), "time") },
                  { label: "Therapist", value: data.staffName },
                  {
                    label: "Services",
                    value: data.patient.services.map((key) => SERVICE_LABELS[key]).join(", "),
                  },
                  { label: "Branch", value: data.branchName },
                ]}
              />
              <div>
                <div className="mb-2 text-sm font-semibold">Session note</div>
                {data.note ? (
                  <div className="rounded-lg border bg-muted/40 p-3.5">
                    <div className="mb-1.5 text-xs font-medium text-muted-foreground">
                      {data.note.authorName}
                      {data.note.version > 1 ? ", edited" : ""}
                    </div>
                    <p className="text-sm leading-relaxed">{data.note.body}</p>
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
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Session</DialogTitle>
              <DialogDescription>{error ?? "Loading the session…"}</DialogDescription>
            </DialogHeader>
            {!error && (
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
