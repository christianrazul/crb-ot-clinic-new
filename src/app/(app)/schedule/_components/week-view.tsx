"use client";

import { addDays, format, parseISO } from "date-fns";

import { useDemoStore } from "@/components/app/demo/demo-store";
import { Card } from "@/components/ui/card";
import { bookableHours, hourGutterLabel } from "@/lib/booking";
import { manilaHour } from "@/lib/dates";
import { appointmentService, appointmentsOn, byId } from "@/lib/demo/selectors";
import { DEMO_TODAY } from "@/lib/fixtures/demo-clock";
import { SERVICE_BG, SERVICE_BLOCK, type ServiceKey } from "@/lib/services";
import { cn } from "@/lib/utils";

const SHOWN = new Set(["scheduled", "checked_in", "attended", "no_show"]);

/** Monday to Saturday at a glance. Clicking a day or a session opens that day. */
export function WeekView({
  weekMonday,
  onOpenDay,
}: {
  weekMonday: string;
  onOpenDay: (date: string) => void;
}) {
  const { state, viewer } = useDemoStore();
  const branch = byId(state.branches, viewer.branchId)!;
  const hours = bookableHours(branch.opensAtHour, branch.closesAtHour);
  const isTherapist = viewer.role === "therapist";

  const days = Array.from({ length: 6 }, (_, index) => {
    const date = format(addDays(parseISO(weekMonday), index), "yyyy-MM-dd");
    const sessions = appointmentsOn(state, date, viewer.branchId).filter(
      (a) => SHOWN.has(a.status) && (!isTherapist || a.staffId === viewer.staffId),
    );
    const perService = (["ot", "aide", "speech", "sped"] as ServiceKey[]).map((service) => ({
      service,
      count: sessions.filter((a) => appointmentService(state, a) === service).length,
    }));
    return { date, sessions, perService, today: date === DEMO_TODAY };
  });

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <div
          className="min-w-[860px]"
          style={{ display: "grid", gridTemplateColumns: "68px repeat(6, minmax(0, 1fr))" }}
        >
          <div className="border-r border-b" />
          {days.map((day) => (
            <button
              key={day.date}
              onClick={() => onOpenDay(day.date)}
              aria-label={`Open ${format(parseISO(day.date), "EEEE, MMM d")}, ${day.sessions.length} booked`}
              className={cn(
                "group flex flex-col items-start gap-2 border-r border-b px-3 py-3 text-left transition-colors last:border-r-0 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
                day.today && "bg-accent/50",
              )}
            >
              <span className="flex w-full items-baseline gap-2">
                <span
                  className={cn(
                    "text-xs",
                    day.today ? "font-medium text-primary" : "text-muted-foreground",
                  )}
                >
                  {format(parseISO(day.date), "EEE")}
                </span>
                <span
                  className={cn(
                    "flex size-7 items-center justify-center rounded-full text-base font-semibold tabular-nums",
                    day.today && "bg-primary text-primary-foreground",
                  )}
                >
                  {format(parseISO(day.date), "d")}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground tabular-nums">
                    {day.sessions.length}
                  </span>{" "}
                  booked
                </span>
              </span>
              <span
                className="flex h-1.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted"
                aria-hidden
              >
                {day.perService
                  .filter((p) => p.count)
                  .map((p) => (
                    <span
                      key={p.service}
                      className={SERVICE_BG[p.service]}
                      style={{ flex: p.count }}
                    />
                  ))}
              </span>
            </button>
          ))}

          <div className="border-r">
            {hours.map((hour) => (
              <div key={hour} className="relative h-[64px] border-b last:border-b-0">
                <span className="absolute top-2 right-2 text-xs text-muted-foreground tabular-nums">
                  {hourGutterLabel(hour)}
                </span>
              </div>
            ))}
          </div>
          {days.map((day) => (
            <div
              key={day.date}
              className={cn("border-r last:border-r-0", day.today && "bg-accent/25")}
            >
              {hours.map((hour) => {
                const list = day.sessions.filter((a) => manilaHour(new Date(a.startsAt)) === hour);
                return (
                  <div
                    key={hour}
                    className="flex h-[64px] flex-col gap-1 border-b p-1 last:border-b-0"
                  >
                    {list.map((appointment) => {
                      const patient = byId(state.patients, appointment.patientId);
                      const staff = byId(state.staff, appointment.staffId);
                      const shortPatient = patient
                        ? `${patient.firstName} ${patient.lastName[0]}.`
                        : "";
                      return (
                        <button
                          key={appointment.id}
                          onClick={() => onOpenDay(day.date)}
                          title={`${patient?.firstName} ${patient?.lastName} with ${staff?.surname}`}
                          className={cn(
                            "flex min-h-0 flex-1 items-center gap-1.5 rounded border-l-[3px] px-2 text-left text-xs transition-[filter] hover:brightness-[0.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                            SERVICE_BLOCK[appointmentService(state, appointment)],
                          )}
                        >
                          <span className="truncate font-semibold">{shortPatient}</span>
                          <span className="ml-auto hidden truncate opacity-70 xl:inline">
                            {staff?.surname}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
