"use client";

import { format, parseISO } from "date-fns";
import { Plus } from "lucide-react";

import { useDemoStore } from "@/components/app/demo/demo-store";
import { useDialogs } from "@/components/app/dialogs/dialog-host";
import { EmptyState } from "@/components/app/detail-bits";
import { StatusBadge } from "@/components/app/status-badge";
import { SvcDot } from "@/components/app/svc-dot";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { bookableHours, hourGutterLabel, hourLabel } from "@/lib/booking";
import { formatManila, manilaHour } from "@/lib/dates";
import { appointmentService, appointmentsOn, byId, displayName } from "@/lib/demo/selectors";
import type { AppointmentFixture } from "@/lib/fixtures/appointments";
import { DEMO_NOW, DEMO_TODAY } from "@/lib/fixtures/demo-clock";
import { initialsOf } from "@/lib/initials";
import { SERVICE_BLOCK, SERVICE_SOFT } from "@/lib/services";
import { cn } from "@/lib/utils";

const ROW_HEIGHT = 72;
const HOLDS_SLOT = new Set(["scheduled", "checked_in", "attended", "no_show"]);

/** One column per staff member, one row per bookable hour. */
export function DayView({ date }: { date: string }) {
  const { state, viewer } = useDemoStore();
  const { openDialog } = useDialogs();
  const branch = byId(state.branches, viewer.branchId)!;
  const hours = bookableHours(branch.opensAtHour, branch.closesAtHour);
  const isTherapist = viewer.role === "therapist";
  const columns = state.staff.filter((s) => s.active && (!isTherapist || s.id === viewer.staffId));
  const appointments = appointmentsOn(state, date, viewer.branchId);
  const closed = !branch.openDays.includes(parseISO(date).getDay());

  if (closed) {
    return (
      <Card>
        <EmptyState
          title={`${branch.name} is closed on ${format(parseISO(date), "EEEE")}s`}
          description="Pick another day, or change operating hours in settings."
        />
      </Card>
    );
  }

  const nowMinutes = (DEMO_NOW.getTime() - new Date(`${date}T00:00:00+08:00`).getTime()) / 60_000;
  const nowTop = ((nowMinutes - branch.opensAtHour * 60) / 60) * ROW_HEIGHT;
  const showNow = date === DEMO_TODAY && nowTop >= 0 && nowTop <= hours.length * ROW_HEIGHT;

  const cellFor = (staffId: string, hour: number): AppointmentFixture | undefined => {
    const here = appointments.filter(
      (a) => a.staffId === staffId && manilaHour(new Date(a.startsAt)) === hour,
    );
    return here.find((a) => HOLDS_SLOT.has(a.status)) ?? here.at(-1);
  };

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <div
          className="min-w-[760px]"
          style={{
            display: "grid",
            gridTemplateColumns: `68px repeat(${columns.length}, minmax(150px, 1fr))`,
          }}
        >
          <div className="sticky left-0 z-10 border-r border-b bg-card" />
          {columns.map((staff) => {
            const rateClass = byId(state.rateClasses, staff.rateClassId);
            const service = rateClass?.service ?? "none";
            return (
              <div
                key={staff.id}
                className="flex items-center gap-2.5 border-r border-b px-3 py-3 last:border-r-0"
              >
                <Avatar className="size-8">
                  <AvatarFallback className={cn("text-[11px]", SERVICE_SOFT[service])}>
                    {initialsOf(staff.displayName)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 leading-tight">
                  <span className="truncate text-sm font-semibold">{staff.surname}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <SvcDot service={service} />
                    {rateClass?.shortName}
                  </span>
                </div>
              </div>
            );
          })}

          <div className="relative sticky left-0 z-10 border-r bg-card">
            {showNow && (
              <div
                className="pointer-events-none absolute inset-x-0 z-[6] flex -translate-y-1/2 items-center justify-end pr-1"
                style={{ top: nowTop }}
              >
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10.5px] font-semibold text-primary-foreground tabular-nums">
                  {formatManila(DEMO_NOW, "time").replace(/ (AM|PM)$/, "")}
                </span>
              </div>
            )}
            {hours.map((hour) => (
              <div key={hour} className="relative h-[72px] border-b last:border-b-0">
                <span className="absolute top-2 right-2 text-xs text-muted-foreground tabular-nums">
                  {hourGutterLabel(hour)}
                </span>
              </div>
            ))}
          </div>

          {columns.map((staff) => (
            <div key={staff.id} className="relative border-r last:border-r-0">
              {hours.map((hour) => {
                const appointment = cellFor(staff.id, hour);
                if (!appointment) {
                  return (
                    <div key={hour} className="group h-[72px] border-b p-1 last:border-b-0">
                      {!isTherapist && (
                        <button
                          aria-label={`Book ${staff.surname} at ${hourLabel(hour)}`}
                          onClick={() =>
                            openDialog({
                              kind: "booking",
                              draft: { staffId: staff.id, date, hour },
                            })
                          }
                          className="flex size-full items-center justify-center gap-1 rounded-md border border-dashed border-transparent text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:border-border hover:bg-muted/50 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          <Plus className="size-3.5" /> Book
                        </button>
                      )}
                    </div>
                  );
                }
                const patient = byId(state.patients, appointment.patientId);
                const type = byId(state.sessionTypes, appointment.sessionTypeId);
                const struck =
                  appointment.status === "cancelled" || appointment.status === "rescheduled";
                return (
                  <div key={hour} className="h-[72px] border-b p-1 last:border-b-0">
                    <button
                      onClick={() => openDialog({ kind: "session", appointmentId: appointment.id })}
                      className={cn(
                        "flex size-full flex-col items-start justify-between rounded-md border-l-[3px] px-2.5 py-1.5 text-left transition-[filter,box-shadow] hover:shadow-sm hover:brightness-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        SERVICE_BLOCK[appointmentService(state, appointment)],
                        struck && "opacity-55",
                      )}
                    >
                      <span
                        className={cn(
                          "w-full truncate text-[13px] font-semibold",
                          struck && "line-through",
                        )}
                      >
                        {patient ? displayName(patient) : "Unknown patient"}
                      </span>
                      <span className="flex w-full items-center gap-1.5">
                        <span className="text-xs opacity-80">{type?.name}</span>
                        {appointment.status !== "scheduled" && (
                          <StatusBadge
                            status={appointment.status}
                            className="ml-auto px-1.5 py-0 text-[10.5px]"
                          />
                        )}
                      </span>
                    </button>
                  </div>
                );
              })}
              {showNow && (
                <div
                  className="pointer-events-none absolute inset-x-0 z-[5] h-0 border-t-2 border-primary/80"
                  style={{ top: nowTop }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
