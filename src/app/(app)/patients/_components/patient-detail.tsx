"use client";

import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  HandCoins,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Receipt,
  UserRound,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { useDemoStore } from "@/components/app/demo/demo-store";
import { EmptyState, Field } from "@/components/app/detail-bits";
import { useDialogs } from "@/components/app/dialogs/dialog-host";
import { PatientAvatar } from "@/components/app/patient-avatar";
import { StatusBadge } from "@/components/app/status-badge";
import { SvcDot } from "@/components/app/svc-dot";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { byId, creditBalanceOf, displayName, patientAge } from "@/lib/demo/selectors";
import type { DemoPatient } from "@/lib/demo/state";
import { DEMO_NOW } from "@/lib/fixtures/demo-clock";
import { formatPeso } from "@/lib/money";
import { SERVICE_LABELS } from "@/lib/services";
import { cn } from "@/lib/utils";

export type PatientTab = "overview" | "sessions" | "credit";

const HISTORY_PAGE_SIZE = 6;
const OT_SESSION_CENTAVOS = 70_000;

const formatIsoDate = (isoDate: string) =>
  isoDate ? formatManila(new Date(`${isoDate}T04:00:00Z`), "date") : "Not recorded";

/** Not built until the patient form lands in Milestone 5. */
const notYet = (what: string) =>
  toast.info(`${what} is not built yet`, {
    description: "It arrives with the patient form in Milestone 5.",
  });

export function PatientDetail({
  patient,
  tab,
  onTabChange,
}: {
  patient: DemoPatient;
  tab: PatientTab;
  onTabChange: (tab: PatientTab) => void;
}) {
  const { state, viewer } = useDemoStore();
  const { openDialog } = useDialogs();
  const [historyPage, setHistoryPage] = React.useState(0);
  const isTherapist = viewer.role === "therapist";
  const name = displayName(patient);
  const balance = creditBalanceOf(state, patient.id);
  const primary = byId(state.staff, patient.primaryStaffId);
  const backup = byId(state.staff, patient.backupStaffId);
  const branch = byId(state.branches, patient.branchId);

  const history = state.appointments
    .filter((a) => a.patientId === patient.id && new Date(a.startsAt) <= DEMO_NOW)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const attended = history.filter((a) => a.status === "attended").length;
  const historyPages = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE));
  const page = Math.min(historyPage, historyPages - 1);
  const historyRows = history.slice(
    page * HISTORY_PAGE_SIZE,
    page * HISTORY_PAGE_SIZE + HISTORY_PAGE_SIZE,
  );

  const ledger = withRunningBalance(
    state.creditLedger.filter((e) => e.patientId === patient.id),
  ).reverse();
  const sessionsLeft = Math.floor(balance / OT_SESSION_CENTAVOS);

  return (
    <Card className="overflow-hidden xl:sticky xl:top-4">
      <div className="flex items-start gap-3.5 p-5">
        <PatientAvatar name={name} service={patient.service} className="size-12 text-sm" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg leading-tight font-semibold tracking-tight">{name}</h2>
          <p className="text-[13px] text-muted-foreground">
            {patient.dateOfBirth ? `${patientAge(patient)} years old` : "Age not recorded"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant={patient.status === "active" ? "success" : "muted"}>
              {patient.status === "active" ? "Active" : "Inactive"}
            </Badge>
            <Badge variant="outline">
              <SvcDot service={patient.service} />
              {SERVICE_LABELS[patient.service]}
            </Badge>
          </div>
        </div>
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
            <DropdownMenuItem onSelect={() => notYet("Editing patient details")}>
              <Pencil /> Edit details
            </DropdownMenuItem>
            {!isTherapist && (
              <DropdownMenuItem
                disabled={patient.status !== "active"}
                onSelect={() => openDialog({ kind: "booking", draft: { patientId: patient.id } })}
              >
                <CalendarPlus /> Book a session
              </DropdownMenuItem>
            )}
            {!isTherapist && (
              <DropdownMenuItem
                onSelect={() => openDialog({ kind: "advance", patientId: patient.id })}
              >
                <HandCoins /> Record advance
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
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
            {!isTherapist && (
              <TabsTrigger value="credit" className="flex-1">
                Credit
                {balance > 0 && (
                  <span className="ml-1 rounded bg-primary/15 px-1 text-[11px] font-semibold text-primary tabular-nums">
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
                <Field label="Gender">
                  {patient.dateOfBirth ? capitalize(patient.gender) : "Not specified"}
                </Field>
                <Field label="Enrolled">
                  <span className="tabular-nums">{formatIsoDate(patient.enrolledOn)}</span>
                </Field>
                <Field label="Branch">{branch?.name.replace(/^CRB\s+/, "")}</Field>
              </dl>
            </section>
            <Separator />
            <section>
              <h3 className="mb-2.5 text-sm font-semibold">Guardian</h3>
              {patient.guardian.name ? (
                <>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9" aria-hidden>
                      <AvatarFallback>
                        <UserRound className="size-4 text-muted-foreground" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid leading-tight">
                      <span className="text-sm font-medium">{patient.guardian.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {patient.guardian.relationship}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-1.5 text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="size-3.5" aria-label="Phone" />
                      <span className="text-foreground tabular-nums">{patient.guardian.phone}</span>
                    </span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="size-3.5" aria-label="Email" />
                      <span className="truncate text-foreground">{patient.guardian.email}</span>
                    </span>
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
                <div className="mt-1 text-sm font-medium">{primary?.shortName ?? "Unassigned"}</div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  {patient.recurringSlot}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Backup</div>
                <div className="mt-1 text-sm font-medium">
                  {backup?.shortName ?? "None assigned"}
                </div>
                {!isTherapist && (
                  <Button
                    variant="link"
                    size="sm"
                    className="mt-0.5 h-auto p-0 text-xs"
                    onClick={() => notYet("Assigning a backup therapist")}
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
                {patient.goalsNotes}
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
                {history.length ? `${Math.round((attended / history.length) * 100)}%` : "–"}
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
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {formatManila(new Date(appointment.startsAt), "date")}
                      </TableCell>
                      <TableCell>
                        <div className="grid leading-tight">
                          <span>{byId(state.sessionTypes, appointment.sessionTypeId)?.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {byId(state.staff, appointment.staffId)?.shortName}
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

        {!isTherapist && (
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
              <Button
                size="sm"
                className="ml-auto"
                onClick={() => openDialog({ kind: "advance", patientId: patient.id })}
              >
                <Plus /> Record advance
              </Button>
            </div>
            {ledger.length ? (
              <div className="mt-3">
                {ledger.map((entry) => {
                  const isTopUp = entry.amountCentavos > 0;
                  return (
                    <div key={entry.id} className="flex gap-3 border-t px-5 py-3 first:border-t-0">
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
                          <span className="truncate text-sm font-medium">{entry.description}</span>
                          <span
                            className={cn(
                              "ml-auto text-sm font-semibold whitespace-nowrap tabular-nums",
                              isTopUp ? "text-success" : "text-foreground",
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
                      </div>
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
    </Card>
  );
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
