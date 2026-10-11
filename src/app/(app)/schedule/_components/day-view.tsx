"use client";

import { format, parseISO } from "date-fns";
import { Plus } from "lucide-react";

import { EmptyState } from "@/components/app/detail-bits";
import { useDialogs } from "@/components/app/dialogs/dialog-host";
import { StatusBadge } from "@/components/app/status-badge";
import { SvcDot } from "@/components/app/svc-dot";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { hourGutterLabel, hourLabel } from "@/lib/booking";
import { formatManila } from "@/lib/dates";
import { initialsOf } from "@/lib/initials";
import { SERVICE_BLOCK, SERVICE_SOFT } from "@/lib/services";
import { cn } from "@/lib/utils";
import type { getDaySchedule, ScheduleAppointment } from "@/server/services/scheduling";

const ROW_HEIGHT = 72;
const HOLDS_SLOT = new Set(["scheduled", "checked_in", "attended", "no_show"]);

type Day = Awaited<ReturnType<typeof getDaySchedule>>;

/** One column per staff member, one row per bookable hour. */
export function DayView({ day, nowIso, isToday }: { day: Day; nowIso: string; isToday: boolean }) {
  const { openDialog } = useDialogs();

  if (!day.open) {
    return (
      <Card>
        <EmptyState
          title={`The clinic is closed on ${format(parseISO(day.date), "EEEE")}s`}
          description="Pick another day, or change operating hours in settings."
        />
      </Card>
    );
  }
  if (!day.columns.length) {
    return (
      <Card>
        <EmptyState
          title="No active staff at this branch"
          description="Add staff in settings to start booking."
        />
      </Card>
    );
  }

  const now = new Date(nowIso);
  const midnight = new Date(`${day.date}T00:00:00+08:00`);
  const nowTop =
    (((now.getTime() - midnight.getTime()) / 60_000 - day.opensAtHour * 60) / 60) * ROW_HEIGHT;
  const showNow = isToday && nowTop >= 0 && nowTop <= day.hours.length * ROW_HEIGHT;

  const cellFor = (staffId: string, hour: number): ScheduleAppointment | undefined => {
    const here = day.appointments.filter((a) => a.staffId === staffId && a.hour === hour);
    return here.find((a) => HOLDS_SLOT.has(a.status)) ?? here.at(-1);
  };

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <div
          className="min-w-[760px]"
          style={{
            display: "grid",
            gridTemplateColumns: `68px repeat(${day.columns.length}, minmax(150px, 1fr))`,
          }}
        >
          <div className="sticky left-0 z-10 border-r border-b bg-card" />
          {day.columns.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-2.5 border-r border-b px-3 py-3 last:border-r-0"
            >
              <Avatar className="size-8">
                <AvatarFallback className={cn("text-[11px]", SERVICE_SOFT[member.service])}>
                  {initialsOf(member.displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 leading-tight">
                <span className="truncate text-sm font-semibold">{member.surname}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <SvcDot service={member.service} />
                  {member.rateClassShort}
                </span>
              </div>
            </div>
          ))}

          <div className="relative sticky left-0 z-10 border-r bg-card">
            {showNow && (
              <div
                className="pointer-events-none absolute inset-x-0 z-[6] flex -translate-y-1/2 items-center justify-end pr-1"
                style={{ top: nowTop }}
              >
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10.5px] font-semibold text-primary-foreground tabular-nums">
                  {formatManila(now, "time").replace(/ (AM|PM)$/, "")}
                </span>
              </div>
            )}
            {day.hours.map((hour) => (
              <div key={hour} className="relative h-[72px] border-b last:border-b-0">
                <span className="absolute top-2 right-2 text-xs text-muted-foreground tabular-nums">
                  {hourGutterLabel(hour)}
                </span>
              </div>
            ))}
          </div>

          {day.columns.map((member) => (
            <div key={member.id} className="relative border-r last:border-r-0">
              {day.hours.map((hour) => {
                const appointment = cellFor(member.id, hour);
                if (!appointment) {
                  return (
                    <div key={hour} className="group h-[72px] border-b p-1 last:border-b-0">
                      {day.canBook && (
                        <button
                          aria-label={`Book ${member.surname} at ${hourLabel(hour)}`}
                          onClick={() =>
                            openDialog({
                              kind: "booking",
                              draft: { staffId: member.id, date: day.date, hour },
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
                const struck =
                  appointment.status === "cancelled" || appointment.status === "rescheduled";
                return (
                  <div key={hour} className="h-[72px] border-b p-1 last:border-b-0">
                    <button
                      onClick={() => openDialog({ kind: "session", appointmentId: appointment.id })}
                      className={cn(
                        "flex size-full flex-col items-start justify-between rounded-md border-l-[3px] px-2.5 py-1.5 text-left transition-[filter,box-shadow] hover:shadow-sm hover:brightness-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        SERVICE_BLOCK[appointment.service],
                        struck && "opacity-55",
                      )}
                    >
                      <span
                        className={cn(
                          "w-full truncate text-[13px] font-semibold",
                          struck && "line-through",
                        )}
                      >
                        {appointment.patientName}
                      </span>
                      <span className="flex w-full items-center gap-1.5">
                        <span className="text-xs">{appointment.sessionTypeName}</span>
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
