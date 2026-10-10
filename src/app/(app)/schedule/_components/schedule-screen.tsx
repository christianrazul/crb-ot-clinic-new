"use client";

import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import * as React from "react";

import { useDemoStore } from "@/components/app/demo/demo-store";
import { Page } from "@/components/app/page-layout";
import { SvcDot } from "@/components/app/svc-dot";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { byId } from "@/lib/demo/selectors";
import { DEMO_TODAY } from "@/lib/fixtures/demo-clock";
import { SERVICE_SHORT, type ServiceKey } from "@/lib/services";

import { DayView } from "./day-view";
import { WeekView } from "./week-view";

const LEGEND: ServiceKey[] = ["ot", "aide", "speech", "sped"];

const iso = (date: Date) => format(date, "yyyy-MM-dd");

/** Step to the next or previous day the branch is open. */
function stepOpenDay(date: string, direction: 1 | -1, openDays: number[]): string {
  let next = parseISO(date);
  for (let i = 0; i < 7; i++) {
    next = addDays(next, direction);
    if (openDays.includes(next.getDay())) break;
  }
  return iso(next);
}

export function ScheduleScreen() {
  const { state, viewer } = useDemoStore();
  const branch = byId(state.branches, viewer.branchId)!;
  const [view, setView] = React.useState<"day" | "week">("day");
  const [date, setDate] = React.useState(DEMO_TODAY);

  const weekMonday = iso(startOfWeek(parseISO(date), { weekStartsOn: 1 }));
  const weekSaturday = addDays(parseISO(weekMonday), 5);
  const isCurrent =
    view === "day"
      ? date === DEMO_TODAY
      : weekMonday === iso(startOfWeek(parseISO(DEMO_TODAY), { weekStartsOn: 1 }));

  const heading =
    view === "day"
      ? format(parseISO(date), "EEE, MMM d, yyyy")
      : weekRangeLabel(parseISO(weekMonday), weekSaturday);

  const step = (direction: 1 | -1) =>
    setDate(
      view === "day"
        ? stepOpenDay(date, direction, branch.openDays)
        : iso(addDays(parseISO(date), direction * 7)),
    );

  return (
    <Page className="gap-4">
      <h1 className="sr-only">{viewer.role === "therapist" ? "My schedule" : "Schedule"}</h1>
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          variant="segment"
          size="sm"
          aria-label="Schedule view"
          value={view}
          onValueChange={(next) => next && setView(next as "day" | "week")}
        >
          <ToggleGroupItem value="day">Day</ToggleGroupItem>
          <ToggleGroupItem value="week">Week</ToggleGroupItem>
        </ToggleGroup>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={view === "day" ? "Previous day" : "Previous week"}
            onClick={() => step(-1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={view === "day" ? "Next day" : "Next week"}
            onClick={() => step(1)}
          >
            <ChevronRight />
          </Button>
        </div>
        <h2
          className="text-base font-semibold tracking-tight tabular-nums sm:text-lg"
          aria-live="polite"
        >
          {heading}
        </h2>
        {!isCurrent && (
          <Button
            variant="ghost"
            size="sm"
            className="text-primary"
            onClick={() => setDate(DEMO_TODAY)}
          >
            {view === "day" ? "Today" : "This week"}
          </Button>
        )}
        <div className="ml-auto hidden items-center gap-4 text-xs text-muted-foreground md:flex">
          {LEGEND.map((service) => (
            <span key={service} className="flex items-center gap-1.5">
              <SvcDot service={service} />
              {SERVICE_SHORT[service]}
            </span>
          ))}
        </div>
      </div>
      {view === "day" ? (
        <DayView date={date} />
      ) : (
        <WeekView
          weekMonday={weekMonday}
          onOpenDay={(day) => {
            setDate(day);
            setView("day");
          }}
        />
      )}
    </Page>
  );
}

function weekRangeLabel(monday: Date, saturday: Date) {
  return monday.getMonth() === saturday.getMonth()
    ? `${format(monday, "MMM d")} – ${format(saturday, "d, yyyy")}`
    : `${format(monday, "MMM d")} – ${format(saturday, "MMM d, yyyy")}`;
}
