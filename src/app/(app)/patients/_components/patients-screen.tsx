"use client";

import { ChevronLeft, ChevronRight, ListFilter, Search, UserPlus, X } from "lucide-react";
import * as React from "react";

import { EmptyState } from "@/components/app/detail-bits";
import { Page, PageHeader } from "@/components/app/page-layout";
import { PatientAvatar } from "@/components/app/patient-avatar";
import { SvcDot } from "@/components/app/svc-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatPeso } from "@/lib/money";
import { SERVICE_SHORT } from "@/lib/services";
import { cn } from "@/lib/utils";
import type { PatientListParams } from "@/lib/validation/patient";
import type { loadPatientsPage } from "@/server/loaders/patients-page";

import { PatientDetail } from "./patient-detail";
import { PatientFormDialog } from "./patient-form-dialog";
import { useUrlParams } from "./use-url-params";

type Data = Awaited<ReturnType<typeof loadPatientsPage>>;

const DEFAULTS = { q: "", service: "all", status: "all", sort: "name", page: "0", tab: "overview" };
const SERVICE_FILTERS = ["all", "ot", "speech", "sped"] as const;

export function PatientsScreen({
  params,
  data,
  isTherapist,
  branchName,
}: {
  params: PatientListParams;
  data: Data;
  isTherapist: boolean;
  branchName: string;
}) {
  const { setParams, pending } = useUrlParams(DEFAULTS);
  const [query, setQuery] = React.useState(params.q);
  const [creating, setCreating] = React.useState(false);
  const { list, detail } = data;
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));

  // Search on the server, 300ms after typing stops.
  React.useEffect(() => {
    if (query === params.q) return;
    const timer = setTimeout(() => setParams({ q: query, page: 0, patient: undefined }), 300);
    return () => clearTimeout(timer);
  }, [query, params.q, setParams]);

  const filtersActive = params.service !== "all" || params.status !== "all" || params.q;
  const select = (patientId: string) => setParams({ patient: patientId, tab: undefined });

  return (
    <Page className="gap-4">
      <PageHeader
        title={isTherapist ? "My patients" : "Patients"}
        description={`${data.activeCount} active patients at ${branchName}`}
      >
        {data.canCreate && (
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <UserPlus /> Add patient
          </Button>
        )}
      </PageHeader>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card
          className={cn("overflow-hidden transition-opacity", pending && "opacity-70")}
          aria-busy={pending}
        >
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by patient or guardian"
                aria-label="Search by patient or guardian"
                className="h-8 pl-8"
              />
            </div>
            <ToggleGroup
              type="single"
              variant="segment"
              size="sm"
              aria-label="Filter by service"
              value={params.service}
              onValueChange={(next) =>
                next && setParams({ service: next, page: 0, patient: undefined })
              }
            >
              {SERVICE_FILTERS.map((value) => (
                <ToggleGroupItem key={value} value={value}>
                  {value !== "all" && <SvcDot service={value} />}
                  {value === "all" ? "All" : SERVICE_SHORT[value]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Select
              value={params.status}
              onValueChange={(next) => setParams({ status: next, page: 0, patient: undefined })}
            >
              <SelectTrigger className="h-8 w-[130px] text-[13px]" aria-label="Filter by status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={params.sort}
              onValueChange={(next) => setParams({ sort: next, page: 0 })}
            >
              <SelectTrigger
                className="h-8 w-auto justify-start text-[13px]"
                aria-label="Sort patients"
              >
                <ListFilter className="size-3.5 shrink-0 text-muted-foreground" />
                <SelectValue>Sort</SelectValue>
              </SelectTrigger>
              <SelectContent align="end" className="min-w-[160px]">
                <SelectItem value="name">Name, A to Z</SelectItem>
                <SelectItem value="age">Age</SelectItem>
                <SelectItem value="attendance">Attendance</SelectItem>
                {data.canSeeMoney && <SelectItem value="balance">Balance</SelectItem>}
              </SelectContent>
            </Select>
            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground"
                onClick={() => {
                  setQuery("");
                  setParams({ q: "", service: "all", status: "all", page: 0, patient: undefined });
                }}
              >
                Reset <X />
              </Button>
            )}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Service</TableHead>
                <TableHead className="hidden md:table-cell xl:hidden min-[87.5rem]:table-cell">
                  Recurring slot
                </TableHead>
                <TableHead className="text-right">Attendance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.rows.map((patient) => {
                const name = `${patient.firstName} ${patient.lastName}`;
                const selected = detail?.patient.id === patient.id;
                return (
                  <TableRow
                    key={patient.id}
                    data-state={selected ? "selected" : undefined}
                    aria-selected={selected}
                    className="cursor-pointer"
                    tabIndex={0}
                    onClick={() => select(patient.id)}
                    onKeyDown={(event) => event.key === "Enter" && select(patient.id)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <PatientAvatar name={name} service={patient.service} />
                        <div className="grid leading-tight whitespace-nowrap">
                          <span className="font-medium">{name}</span>
                          <span className="text-xs text-muted-foreground">
                            {patient.age === null ? "Age not recorded" : `${patient.age} yrs`}
                            {patient.owedCentavos > 0 && (
                              <span className="text-danger-strong">
                                , owes {formatPeso(patient.owedCentavos)}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <SvcDot service={patient.service} />
                        {SERVICE_SHORT[patient.service]}
                      </span>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground md:table-cell xl:hidden min-[87.5rem]:table-cell">
                      {patient.recurringSlot}
                    </TableCell>
                    <TableCell className="text-right">
                      {patient.attendancePct === null ? "–" : `${patient.attendancePct}%`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={patient.status === "active" ? "success" : "muted"}>
                        {patient.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!list.rows.length && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5}>
                    <EmptyState
                      title={filtersActive ? "No patients match these filters" : "No patients yet"}
                      description={
                        filtersActive
                          ? "Try another service or clear the search."
                          : isTherapist
                            ? "Patients assigned to you will show here."
                            : "Add the first patient with the button above."
                      }
                      className="py-12"
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t px-5 py-3 text-sm">
            <span className="text-muted-foreground tabular-nums">
              {list.total
                ? `${list.page * list.pageSize + 1}–${Math.min(list.total, list.page * list.pageSize + list.pageSize)} of ${list.total} patients`
                : "0 patients"}
            </span>
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
                Page {list.page + 1} of {pages}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={list.page === 0}
                onClick={() => setParams({ page: list.page - 1, patient: undefined })}
                aria-label="Previous page"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={list.page >= pages - 1}
                onClick={() => setParams({ page: list.page + 1, patient: undefined })}
                aria-label="Next page"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </Card>
        {detail && (
          <PatientDetail
            key={detail.patient.id}
            detail={detail}
            tab={params.tab === "credit" && !data.canSeeMoney ? "overview" : params.tab}
            onTabChange={(tab) => setParams({ tab })}
            canWrite={data.canWrite}
            canEdit={data.canCreate}
            isTherapist={data.isTherapist}
            canSeeMoney={data.canSeeMoney}
            staffOptions={data.staffOptions}
          />
        )}
      </div>
      {creating && (
        <PatientFormDialog
          open={creating}
          onOpenChange={setCreating}
          staffOptions={data.staffOptions}
          assignedToMe={data.isTherapist}
          onSaved={(id) => setParams({ patient: id, tab: undefined })}
        />
      )}
    </Page>
  );
}
