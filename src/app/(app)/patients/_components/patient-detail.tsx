"use client";

import {
  Ban,
  CalendarPlus,
  ChevronLeft,
  Download,
  EyeOff,
  ChevronRight,
  Clock,
  HandCoins,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Receipt,
  SlidersHorizontal,
  Trash2,
  UserRound,
  UserX,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { EmptyState, Field } from "@/components/app/detail-bits";
import { voidCreditEntryAction } from "@/app/(app)/billing/actions";
import { useDialogs } from "@/components/app/dialogs/dialog-host";
import { ReasonDialog } from "@/components/app/dialogs/reason-dialog";
import { PatientAvatar } from "@/components/app/patient-avatar";
import { useViewer } from "@/components/app/shell/viewer-context";
import { StatusBadge } from "@/components/app/status-badge";
import { SvcDot } from "@/components/app/svc-dot";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { withRunningBalance } from "@/lib/credit";
import { formatManila } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import { SERVICE_LABELS } from "@/lib/services";
import { cn } from "@/lib/utils";
import type { PatientDetailData } from "@/server/loaders/patients-page";

import { anonymizePatientAction, deletePatientAction, setPatientStatusAction } from "../actions";
import { AdjustCreditDialog } from "./adjust-credit-dialog";
import { PatientFormDialog, type StaffOption } from "./patient-form-dialog";

export type PatientTab = "overview" | "sessions" | "credit";

const HISTORY_PAGE_SIZE = 6;
const OT_SESSION_CENTAVOS = 70_000;

const formatIsoDate = (isoDate: string | null) =>
  isoDate ? formatManila(new Date(`${isoDate}T04:00:00Z`), "date") : "Not recorded";

const GENDER: Record<string, string> = {
  male: "Male",
  female: "Female",
  unspecified: "Not specified",
};

export function PatientDetail({
  detail,
  tab,
  onTabChange,
  canWrite,
  canEdit,
  isTherapist,
  canSeeMoney,
  staffOptions,
}: {
  detail: PatientDetailData;
  tab: PatientTab;
  onTabChange: (tab: PatientTab) => void;
  canWrite: boolean;
  /** Edit details only: therapists, for their own patients. */
  canEdit: boolean;
  isTherapist: boolean;
  canSeeMoney: boolean;
  staffOptions: StaffOption[];
}) {
  const { openDialog } = useDialogs();
  const [historyPage, setHistoryPage] = React.useState(0);
  const [editing, setEditing] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState(false);
  const [confirmAnonymize, setConfirmAnonymize] = React.useState(false);
  const [adjusting, setAdjusting] = React.useState(false);
  const [voidingEntry, setVoidingEntry] = React.useState<{
    id: string;
    description: string;
    amountCentavos: number;
  } | null>(null);
  const [typedName, setTypedName] = React.useState("");
  const [anonymizeError, setAnonymizeError] = React.useState<string | null>(null);
  const isOwner = useViewer().role === "superadmin";
  const [pending, startTransition] = React.useTransition();
  const { patient, guardians } = detail;
  const guardian = guardians[0];
  const name = `${patient.firstName} ${patient.lastName}`;
  const active = patient.status === "active";

  const history = detail.history;
  const attended = history.filter((a) => a.status === "attended").length;
  const counted = history.filter((a) => a.status === "attended" || a.status === "no_show").length;
  const historyPages = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE));
  const page = Math.min(historyPage, historyPages - 1);
  const historyRows = history.slice(
    page * HISTORY_PAGE_SIZE,
    page * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE,
  );

  const balance = detail.credit?.balance ?? 0;
  const ledger = detail.credit
    ? withRunningBalance(
        detail.credit.entries.map((e) => ({
          ...e,
          createdAt: new Date(e.createdAt).toISOString(),
        })),
      ).reverse()
    : [];
  const sessionsLeft = Math.floor(balance / OT_SESSION_CENTAVOS);

  const toggleActive = () =>
    startTransition(async () => {
      const result = await setPatientStatusAction(patient.id, active ? "inactive" : "active");
      if (result.ok)
        toast.success(`${name} set ${active ? "inactive" : "active"}`, {
          description: active
            ? "They can't be booked until set active again."
            : "They can be booked again.",
        });
      else toast.error(result.error);
    });

  const anonymize = () =>
    startTransition(async () => {
      setAnonymizeError(null);
      const result = await anonymizePatientAction({
        patientId: patient.id,
        confirmName: typedName,
      });
      if (!result.ok) return setAnonymizeError(result.error);
      setConfirmAnonymize(false);
      toast.success("Patient anonymized", {
        description: "Their details are erased. Sessions, notes and payments stay on record.",
      });
    });

  const remove = () =>
    startTransition(async () => {
      const result = await deletePatientAction(patient.id);
      setConfirmRemove(false);
      if (result.ok)
        toast.success(`${name} removed`, {
          description: "Their sessions and payments stay on record.",
        });
      else toast.error(result.error);
    });

  return (
    <Card className={cn("overflow-hidden xl:sticky xl:top-4", pending && "opacity-70")}>
      <div className="flex items-start gap-3.5 p-5">
        <PatientAvatar name={name} service={patient.service} className="size-12 text-sm" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg leading-tight font-semibold tracking-tight">{name}</h2>
          <p className="text-[13px] text-muted-foreground">
            {detail.age === null ? "Age not recorded" : `${detail.age} years old`}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant={active ? "success" : "muted"}>{active ? "Active" : "Inactive"}</Badge>
            <Badge variant="outline">
              <SvcDot service={patient.service} />
              {SERVICE_LABELS[patient.service]}
            </Badge>
          </div>
        </div>
        {!canWrite && canEdit && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="-mr-1 text-muted-foreground"
            aria-label="Edit details"
            onClick={() => setEditing(true)}
          >
            <Pencil />
          </Button>
        )}
        {canWrite && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="-mr-1 text-muted-foreground"
                aria-label="Patient actions"
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil /> Edit details
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!active}
                onSelect={() =>
                  openDialog({
                    kind: "booking",
                    draft: {
                      patientId: patient.id,
                      patientName: name,
                      patientService: patient.service,
                    },
                  })
                }
              >
                <CalendarPlus /> Book a session
              </DropdownMenuItem>
              {canSeeMoney && (
                <DropdownMenuItem
                  onSelect={() =>
                    openDialog({
                      kind: "advance",
                      patient: { id: patient.id, name, service: patient.service },
                    })
                  }
                >
                  <HandCoins /> Record advance
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={toggleActive}>
                <UserX /> {active ? "Set inactive" : "Set active"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => setConfirmRemove(true)}
                className="text-danger focus:text-danger"
              >
                <Trash2 /> Remove patient
              </DropdownMenuItem>
              {isOwner && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href={`/api/patients/${patient.id}/export`} download>
                      <Download /> Export data
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      setTypedName("");
                      setAnonymizeError(null);
                      setConfirmAnonymize(true);
                    }}
                    className="text-danger focus:text-danger"
                  >
                    <EyeOff /> Anonymize
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Tabs value={tab} onValueChange={(next) => onTabChange(next as PatientTab)}>
        <div className="px-5">
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1">
              Overview
            </TabsTrigger>
            <TabsTrigger value="sessions" className="flex-1">
              Sessions
            </TabsTrigger>
            {canSeeMoney && (
              <TabsTrigger value="credit" className="flex-1">
                Credit
                {balance > 0 && (
                  <span className="ml-1 rounded bg-accent px-1 text-[11px] font-semibold text-accent-foreground tabular-nums">
                    {formatPeso(balance)}
                  </span>
                )}
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <TabsContent value="overview" className="p-5 pt-4">
          <div className="grid gap-5">
            <section>
              <h3 className="mb-2.5 text-sm font-semibold">Client</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Field label="Diagnosis" className="col-span-2">
                  {patient.diagnosis || "No diagnosis on file"}
                </Field>
                <Field label="Date of birth">
                  <span className="tabular-nums">{formatIsoDate(patient.dateOfBirth)}</span>
                </Field>
                <Field label="Gender">{GENDER[patient.gender]}</Field>
                <Field label="Enrolled">
                  <span className="tabular-nums">{formatIsoDate(patient.enrolledOn)}</span>
                </Field>
                <Field label="Recurring slot">{patient.recurringSlot}</Field>
              </dl>
            </section>
            <Separator />
            <section>
              <h3 className="mb-2.5 text-sm font-semibold">Guardian</h3>
              {guardian?.name ? (
                <>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9" aria-hidden>
                      <AvatarFallback>
                        <UserRound className="size-4 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid leading-tight">
                      <span className="text-sm font-medium">{guardian.name}</span>
                      <span className="text-xs text-muted-foreground">{guardian.relationship}</span>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-1.5 text-sm">
                    {guardian.phone && (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="size-3.5" aria-label="Phone" />
                        <span className="text-foreground tabular-nums">{guardian.phone}</span>
                      </span>
                    )}
                    {guardian.email && (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="size-3.5" aria-label="Email" />
                        <span className="truncate text-foreground">{guardian.email}</span>
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">No guardian on file yet.</p>
              )}
            </section>
            <Separator />
            <section className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Primary therapist</div>
                <div className="mt-1 text-sm font-medium">
                  {detail.primaryStaffName ?? "Unassigned"}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  {patient.recurringSlot}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Backup</div>
                <div className="mt-1 text-sm font-medium">
                  {detail.backupStaffNames.length
                    ? detail.backupStaffNames.join(", ")
                    : "None assigned"}
                </div>
                {canWrite && !detail.backupStaffNames.length && (
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-0.5 h-auto p-0 text-xs"
                    onClick={() => setEditing(true)}
                  >
                    <Plus className="size-3!" />
                    Add backup
                  </Button>
                )}
              </div>
            </section>
            <section>
              <h3 className="mb-2 text-sm font-semibold">Goals and notes</h3>
              <p className="rounded-lg bg-muted/60 p-3 text-sm leading-relaxed text-muted-foreground">
                {patient.goalsNotes || "No goals recorded yet."}
              </p>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="pt-4">
          <div className="flex items-center gap-4 px-5 pb-3 text-sm">
            <span>
              <span className="font-semibold tabular-nums">{history.length}</span>{" "}
              <span className="text-muted-foreground">sessions</span>
            </span>
            <span>
              <span className="font-semibold tabular-nums">{attended}</span>{" "}
              <span className="text-muted-foreground">attended</span>
            </span>
            <span>
              <span className="font-semibold tabular-nums">
                {counted ? `${Math.round((attended / counted) * 100)}%` : "–"}
              </span>{" "}
              <span className="text-muted-foreground">rate</span>
            </span>
          </div>
          {historyRows.length ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Session</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {historyRows.map((appointment) => (
                    <TableRow
                      key={appointment.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() => openDialog({ kind: "history", appointmentId: appointment.id })}
                      onKeyDown={(event) =>
                        event.key === "Enter" &&
                        openDialog({ kind: "history", appointmentId: appointment.id })
                      }
                    >
                      <TableCell className="whitespace-nowrap">
                        {formatManila(new Date(appointment.startsAt), "date")}
                      </TableCell>
                      <TableCell>
                        <div className="grid leading-tight">
                          <span>{appointment.sessionTypeName}</span>
                          <span className="text-xs text-muted-foreground">
                            {appointment.staffName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={appointment.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between border-t px-5 py-3 text-sm text-muted-foreground">
                <span className="tabular-nums">
                  {page * HISTORY_PAGE_SIZE + 1}–
                  {Math.min(history.length, page * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE)} of{" "}
                  {history.length}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={page === 0}
                    onClick={() => setHistoryPage(page - 1)}
                    aria-label="Previous sessions"
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={page >= historyPages - 1}
                    onClick={() => setHistoryPage(page + 1)}
                    aria-label="Next sessions"
                  >
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              title="No sessions yet"
              description={`${patient.firstName}'s sessions show here once they start.`}
            />
          )}
        </TabsContent>

        {canSeeMoney && (
          <TabsContent value="credit" className="pt-4">
            <div className="mx-5 flex items-center gap-4 rounded-lg border bg-accent/50 p-4">
              <div>
                <div className="text-xs text-muted-foreground">Credit balance</div>
                <div className="text-2xl font-semibold tracking-tight tabular-nums">
                  {formatPeso(balance)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {balance > 0
                    ? `About ${sessionsLeft} OT session${sessionsLeft === 1 ? "" : "s"} left`
                    : "No advance payment on file"}
                </div>
              </div>
              <div className="ml-auto flex flex-col gap-1.5">
                <Button
                  size="sm"
                  onClick={() =>
                    openDialog({
                      kind: "advance",
                      patient: { id: patient.id, name, service: patient.service },
                    })
                  }
                >
                  <Plus /> Record advance
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAdjusting(true)}>
                  <SlidersHorizontal /> Adjust balance
                </Button>
              </div>
            </div>
            {ledger.length ? (
              <div className="mt-3">
                {ledger.map((entry) => {
                  const isTopUp = entry.amountCentavos > 0;
                  const voided = Boolean(entry.voidedAt);
                  return (
                    <div
                      key={entry.id}
                      className={cn(
                        "flex gap-3 border-t px-5 py-3 first:border-t-0",
                        voided && "opacity-60",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                          isTopUp
                            ? "bg-success-soft text-success-strong"
                            : "bg-muted text-muted-foreground",
                        )}
                        aria-hidden
                      >
                        {isTopUp ? <Plus className="size-3.5" /> : <Receipt className="size-3.5" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span
                            className={cn("truncate text-sm font-medium", voided && "line-through")}
                          >
                            {entry.description}
                          </span>
                          {voided && <Badge variant="muted">Voided</Badge>}
                          <span
                            className={cn(
                              "ml-auto text-sm font-semibold whitespace-nowrap tabular-nums",
                              isTopUp && !voided ? "text-success-strong" : "text-foreground",
                              voided && "line-through",
                            )}
                          >
                            {isTopUp
                              ? `+${formatPeso(entry.amountCentavos)}`
                              : formatPeso(entry.amountCentavos)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-baseline gap-2 text-xs text-muted-foreground">
                          <span className="tabular-nums">
                            {formatManila(new Date(entry.createdAt), "date")}, receipt{" "}
                            {entry.receiptNo}
                            {entry.referenceNo ? `, ref ${entry.referenceNo}` : ""}
                          </span>
                          <span className="ml-auto whitespace-nowrap tabular-nums">
                            Bal. {formatPeso(entry.balanceAfterCentavos)}
                          </span>
                        </div>
                        {entry.notes && (
                          <p className="mt-2 rounded-md bg-muted/60 px-2.5 py-1.5 text-xs leading-relaxed text-muted-foreground">
                            {entry.notes}
                          </p>
                        )}
                        {voided && entry.voidReason && (
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            Voided {formatManila(new Date(entry.voidedAt!), "date")}:{" "}
                            {entry.voidReason}
                          </p>
                        )}
                      </div>
                      {!voided && entry.type !== "deduction" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="-mr-2 text-muted-foreground"
                              aria-label={`Actions for ${entry.description} ${formatManila(new Date(entry.createdAt), "date")}`}
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            {entry.type === "top_up" && (
                              <DropdownMenuItem
                                onSelect={() =>
                                  openDialog({
                                    kind: "advance",
                                    patient: { id: patient.id, name, service: patient.service },
                                    correcting: {
                                      entryId: entry.id,
                                      amountCentavos: entry.amountCentavos,
                                      method: entry.method,
                                      referenceNo: entry.referenceNo,
                                      receiptNo: entry.receiptNo,
                                      notes: entry.notes,
                                    },
                                  })
                                }
                              >
                                <Pencil /> Edit
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-danger focus:text-danger"
                              onSelect={() => setVoidingEntry(entry)}
                            >
                              <Ban /> Void
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState title={`No advance payments recorded for ${patient.firstName} yet.`} />
            )}
          </TabsContent>
        )}
      </Tabs>

      {editing && (
        <PatientFormDialog
          open={editing}
          onOpenChange={setEditing}
          staffOptions={staffOptions}
          existing={detail}
          assignedToMe={isTherapist}
        />
      )}
      {adjusting && (
        <AdjustCreditDialog
          patientId={patient.id}
          patientName={name}
          balanceCentavos={balance}
          onClose={() => setAdjusting(false)}
        />
      )}
      {voidingEntry && (
        <ReasonDialog
          title={`Void this ${formatPeso(Math.abs(voidingEntry.amountCentavos))} entry?`}
          description={`"${voidingEntry.description}" stays on the ledger, marked voided, and stops counting toward ${patient.firstName}'s balance. If the credit was already spent on sessions, void those payments first.`}
          confirmLabel="Void entry"
          onClose={() => setVoidingEntry(null)}
          onConfirm={async (reason) => {
            const result = await voidCreditEntryAction(voidingEntry.id, reason);
            if (result.ok) toast.success("Entry voided");
            return result.ok ? { ok: true } : result;
          }}
        />
      )}
      <Dialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {name}?</DialogTitle>
            <DialogDescription>
              They leave the patient list and can no longer be booked. Their sessions, notes and
              payments stay on record. To pause them instead, set them inactive.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemove(false)}>
              Keep patient
            </Button>
            <Button variant="destructive" onClick={remove} disabled={pending}>
              Remove patient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmAnonymize} onOpenChange={setConfirmAnonymize}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Anonymize {name}?</DialogTitle>
            <DialogDescription>
              This permanently erases their name, birth date, diagnosis, goals and guardian
              contacts, and removes them from the patient list. Sessions, notes and payments stay on
              record without their details. Export their data first if they asked for a copy. This
              can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-1.5">
            <Label htmlFor="anonymize-confirm">Type {name} to confirm</Label>
            <Input
              id="anonymize-confirm"
              autoComplete="off"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
            />
            {anonymizeError && (
              <p role="alert" className="text-sm text-danger-strong">
                {anonymizeError}
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAnonymize(false)}>
              Keep details
            </Button>
            <Button
              variant="destructive"
              onClick={anonymize}
              disabled={pending || typedName.trim().toLowerCase() !== name.toLowerCase()}
            >
              Anonymize patient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
