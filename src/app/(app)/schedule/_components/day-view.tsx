"use client";

import { format, parseISO } from "date-fns";
import { Plus } from "lucide-react";

import { EmptyState } from "@/components/app/detail-bits";
import { useDialogs } from "@/components/app/dialogs/dialog-host";
import { StatusBadge } from "@/components/app/status-badge";
import { SvcDot } from "@/components/app/svc-dot";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { hourGutterLabel, minutesLabel, toMinutes } from "@/lib/booking";
import { formatManila } from "@/lib/dates";
import { initialsOf } from "@/lib/initials";
import { SERVICE_BLOCK, SERVICE_SOFT } from "@/lib/services";
import { cn } from "@/lib/utils";
import type { getDaySchedule, ScheduleAppointment } from "@/server/services/scheduling";

const ROW_HEIGHT = 72;
const HOLDS_SLOT = new Set(["scheduled", "checked_in", "attended", "no_show"]);

const startOf = (a: ScheduleAppointment) => toMinutes(a.hour, a.minute);
const endOf = (a: ScheduleAppointment) => startOf(a) + a.durationMinutes;
const overlaps = (a: ScheduleAppointment, b: ScheduleAppointment) =>
  startOf(a) < endOf(b) && startOf(b) < endOf(a);

type Placed = { appointment: ScheduleAppointment; lane: number; lanes: number };

/**
 * One therapist's sessions for the day, with side-by-side lanes where they
 * overlap (several patients in one hour). A cancelled or moved session shows
 * only where nothing active replaced it.
 */
function layoutColumn(all: ScheduleAppointment[]): Placed[] {
  const active = all.filter((a) => HOLDS_SLOT.has(a.status));
  const shown = [...active];
  for (const a of all.filter((x) => !HOLDS_SLOT.has(x.status)).reverse()) {
    if (!shown.some((b) => overlaps(a, b))) shown.push(a);
  }
  shown.sort((a, b) => startOf(a) - startOf(b));
  const placed: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  const close = () => {
    const lanes = Math.max(1, ...cluster.map((p) => p.lane + 1));
    for (const p of cluster) p.lanes = lanes;
    placed.push(...cluster);
    cluster = [];
  };
  for (const appointment of shown) {
    if (cluster.length && startOf(appointment) >= clusterEnd) close();
    const taken = new Set(
      cluster.filter((p) => overlaps(p.appointment, appointment)).map((p) => p.lane),
    );
    let lane = 0;
    while (taken.has(lane)) lane++;
    cluster.push({ appointment, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, endOf(appointment));
  }
  close();
  return placed;
}

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

  const dayTop = day.opensAtHour * 60;
  const bodyHeight = day.hours.length * ROW_HEIGHT;

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

          {day.columns.map((member) => {
            const placed = layoutColumn(day.appointments.filter((a) => a.staffId === member.id));
            return (
              <div
                key={member.id}
                className="relative border-r last:border-r-0"
                style={{ height: bodyHeight }}
              >
                {day.hours.flatMap((hour) =>
                  [0, 30].map((minute) => (
                    <div
                      key={`${hour}:${minute}`}
                      className={cn(
                        "group h-9 p-0.5",
                        minute === 30 ? "border-b" : "border-b border-b-border/40",
                      )}
                    >
                      {day.canBook && (
                        <button
                          aria-label={`Book ${member.surname} at ${minutesLabel(toMinutes(hour, minute))}`}
                          onClick={() =>
                            openDialog({
                              kind: "booking",
                              draft: { staffId: member.id, date: day.date, hour, minute },
                            })
                          }
                          className="flex size-full items-center justify-center gap-1 rounded-md border border-dashed border-transparent text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:border-border hover:bg-muted/50 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                        >
                          <Plus className="size-3.5" /> Book
                        </button>
                      )}
                    </div>
                  )),
                )}
                {placed.map(({ appointment, lane, lanes }) => {
                  const struck =
                    appointment.status === "cancelled" || appointment.status === "rescheduled";
                  const height = (appointment.durationMinutes / 60) * ROW_HEIGHT;
                  const compact = lanes > 1 || height < ROW_HEIGHT;
                  return (
                    <button
                      key={appointment.id}
                      onClick={() => openDialog({ kind: "session", appointmentId: appointment.id })}
                      style={{
                        top: ((startOf(appointment) - dayTop) / 60) * ROW_HEIGHT + 2,
                        height: height - 4,
                        left: `calc(${(lane / lanes) * 100}% + 4px)`,
                        width: `calc(${100 / lanes}% - 8px)`,
                      }}
                      className={cn(
                        "absolute z-[2] flex min-h-0 flex-col items-start rounded-md border-l-[3px] text-left transition-[filter,box-shadow] hover:shadow-sm hover:brightness-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                        compact ? "justify-center px-2 py-0" : "justify-between px-2.5 py-1.5",
                        SERVICE_BLOCK[appointment.service],
                        struck && "opacity-55",
                      )}
                    >
                      <span
                        className={cn(
                          "w-full truncate font-semibold",
                          compact ? "text-xs" : "text-[13px]",
                          struck && "line-through",
                        )}
                      >
                        {appointment.patientName}
                      </span>
                      {!compact && (
                        <span className="flex w-full items-center gap-1.5">
                          <span className="text-xs">{appointment.sessionTypeName}</span>
                          {appointment.status !== "scheduled" && (
                            <StatusBadge
                              status={appointment.status}
                              className="ml-auto px-1.5 py-0 text-[10.5px]"
                            />
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
                {showNow && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-[5] h-0 border-t-2 border-primary/80"
                    style={{ top: nowTop }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
