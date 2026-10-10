"use client";

import { ChevronLeft, ChevronRight, ListFilter, Search, UserPlus, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { useDemoStore } from "@/components/app/demo/demo-store";
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
import { byId, displayName, patientAge, visiblePatients } from "@/lib/demo/selectors";
import { formatPeso } from "@/lib/money";
import { SERVICE_SHORT } from "@/lib/services";

import { PatientDetail, type PatientTab } from "./patient-detail";

const PAGE_SIZE = 9;
const SERVICE_FILTERS = [
  { value: "all", label: "All" },
  { value: "ot", label: "OT" },
  { value: "speech", label: "Speech" },
  { value: "sped", label: "SPED" },
] as const;
type ServiceFilter = (typeof SERVICE_FILTERS)[number]["value"];
type SortKey = "name" | "age" | "attendance" | "balance";

export function PatientsScreen() {
  const { state, viewer } = useDemoStore();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const isTherapist = viewer.role === "therapist";

  const [query, setQuery] = React.useState("");
  const [service, setService] = React.useState<ServiceFilter>("all");
  const [status, setStatus] = React.useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = React.useState<SortKey>("name");
  const [page, setPage] = React.useState(0);

  const roster = visiblePatients(state, viewer.role, viewer.staffId, viewer.branchId);
  const needle = query.trim().toLowerCase();
  const filtered = roster
    .filter((p) => service === "all" || p.service === service)
    .filter((p) => status === "all" || p.status === status)
    .filter(
      (p) =>
        !needle ||
        displayName(p).toLowerCase().includes(needle) ||
        p.guardian.name.toLowerCase().includes(needle),
    )
    .sort(sorters[sort]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const rows = filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  // Selection lives in the URL (by id, never by name) so links can open a patient.
  const selected = byId(roster, params.get("patient")) ?? rows[0] ?? roster[0];
  const tabParam = params.get("tab");
  const tab: PatientTab =
    tabParam === "sessions" || (tabParam === "credit" && !isTherapist) ? tabParam : "overview";

  const select = (patientId: string, nextTab: PatientTab = "overview") =>
    router.replace(
      `${pathname}?patient=${patientId}${nextTab === "overview" ? "" : `&tab=${nextTab}`}` as Route,
      {
        scroll: false,
      },
    );

  const resetPage =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(0);
    };
  const filtersActive = service !== "all" || status !== "all" || needle;
  const activeCount = roster.filter((p) => p.status === "active").length;

  return (
    <Page className="gap-4">
      <PageHeader
        title={isTherapist ? "My patients" : "Patients"}
        description={`${activeCount} active patients at ${viewer.branchName}`}
      >
        {!isTherapist && (
          <Button size="sm" variant="outline" asChild>
            <Link href="/settings?tab=patients">
              <UserPlus /> Add patient
            </Link>
          </Button>
        )}
      </PageHeader>
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b p-3">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => resetPage(setQuery)(event.target.value)}
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
              value={service}
              onValueChange={(next) => next && resetPage(setService)(next as ServiceFilter)}
            >
              {SERVICE_FILTERS.map((option) => (
                <ToggleGroupItem key={option.value} value={option.value}>
                  {option.value !== "all" && <SvcDot service={option.value} />}
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Select
              value={status}
              onValueChange={(next) => resetPage(setStatus)(next as typeof status)}
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
            <Select value={sort} onValueChange={(next) => resetPage(setSort)(next as SortKey)}>
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
                {!isTherapist && <SelectItem value="balance">Balance</SelectItem>}
              </SelectContent>
            </Select>
            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground"
                onClick={() => {
                  setService("all");
                  setStatus("all");
                  setQuery("");
                  setPage(0);
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
                <TableHead className="hidden lg:table-cell xl:hidden min-[106.25rem]:table-cell">
                  Primary therapist
                </TableHead>
                <TableHead className="text-right">Attendance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((patient) => {
                const name = displayName(patient);
                const isSelected = selected?.id === patient.id;
                const owes = !isTherapist && patient.balanceOwedCentavos > 0;
                return (
                  <TableRow
                    key={patient.id}
                    data-state={isSelected ? "selected" : undefined}
                    aria-selected={isSelected}
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
                            {patientAge(patient)} yrs
                            {owes && (
                              <span className="text-danger">
                                , owes {formatPeso(patient.balanceOwedCentavos)}
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
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell xl:hidden min-[106.25rem]:table-cell">
                      {byId(state.staff, patient.primaryStaffId)?.shortName ?? "Unassigned"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {patient.attendancePct ? `${patient.attendancePct}%` : "–"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={patient.status === "active" ? "success" : "muted"}>
                        {patient.status === "active" ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!rows.length && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6}>
                    <EmptyState
                      title={roster.length ? "No patients match these filters" : "No patients yet"}
                      description={
                        roster.length
                          ? "Try another service or clear the search."
                          : isTherapist
                            ? "Patients assigned to you will show here."
                            : "Add the first patient from settings."
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
              {filtered.length
                ? `${currentPage * PAGE_SIZE + 1}–${Math.min(filtered.length, currentPage * PAGE_SIZE + PAGE_SIZE)} of ${filtered.length} patients`
                : "0 patients"}
            </span>
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">
                Page {currentPage + 1} of {pages}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
                aria-label="Previous page"
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={currentPage >= pages - 1}
                onClick={() => setPage(currentPage + 1)}
                aria-label="Next page"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        </Card>
        {selected && (
          <PatientDetail
            key={selected.id}
            patient={selected}
            tab={tab}
            onTabChange={(next) => select(selected.id, next)}
          />
        )}
      </div>
    </Page>
  );
}

type Row = ReturnType<typeof visiblePatients>[number];
const sorters: Record<SortKey, (a: Row, b: Row) => number> = {
  name: (a, b) => displayName(a).localeCompare(displayName(b)),
  // Youngest first, as in the mockup.
  age: (a, b) => b.dateOfBirth.localeCompare(a.dateOfBirth),
  attendance: (a, b) => b.attendancePct - a.attendancePct,
  balance: (a, b) => b.balanceOwedCentavos - a.balanceOwedCentavos,
};
