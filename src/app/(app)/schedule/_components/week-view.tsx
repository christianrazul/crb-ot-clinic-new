"use client";

import { format, parseISO } from "date-fns";

import { EmptyState } from "@/components/app/detail-bits";
import { Card } from "@/components/ui/card";
import { hourGutterLabel } from "@/lib/booking";
import { SERVICE_BG, SERVICE_BLOCK, type ServiceKey } from "@/lib/services";
import { cn } from "@/lib/utils";
import type { getWeekSchedule } from "@/server/services/scheduling";

type Week = Awaited<ReturnType<typeof getWeekSchedule>>;

/** The open days of a week at a glance. Clicking a day or a session opens that day. */
export function WeekView({
  week,
  today,
  onOpenDay,
}: {
  week: Week;
  today: string;
  onOpenDay: (date: string) => void;
}) {
  if (!week.days.length) {
    return (
      <Card>
        <EmptyState
          title="The clinic is closed all week"
          description="Change operating hours in settings."
        />
      </Card>
    );
  }
  const days = week.days.map((date) => {
    const sessions = week.appointments.filter((a) => a.date === date);
    const perService = (["ot", "aide", "speech", "sped"] as ServiceKey[]).map((service) => ({
      service,
      count: sessions.filter((a) => a.service === service).length,
    }));
    return { date, sessions, perService, today: date === today };
  });

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <div
          className="min-w-[860px]"
          style={{
            display: "grid",
            gridTemplateColumns: `68px repeat(${days.length}, minmax(0, 1fr))`,
          }}
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
            {week.hours.map((hour) => (
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
              {week.hours.map((hour) => (
                <div
                  key={hour}
                  className="flex h-[64px] flex-col gap-1 border-b p-1 last:border-b-0"
                >
                  {day.sessions
                    .filter((a) => a.hour === hour)
                    .map((a) => (
                      <button
                        key={a.id}
                        onClick={() => onOpenDay(day.date)}
                        title={a.patientName}
                        className={cn(
                          "flex min-h-0 flex-1 items-center gap-1.5 rounded border-l-[3px] px-2 text-left text-xs transition-[filter] hover:brightness-[0.97] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          SERVICE_BLOCK[a.service],
                        )}
                      >
                        <span className="truncate font-semibold">{a.patientShort}</span>
                      </button>
                    ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
