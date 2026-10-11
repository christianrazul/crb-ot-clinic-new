"use client";

import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Page } from "@/components/app/page-layout";
import { SvcDot } from "@/components/app/svc-dot";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SERVICE_SHORT, type ServiceKey } from "@/lib/services";
import { cn } from "@/lib/utils";
import type { SchedulePageData } from "@/server/loaders/schedule-page";

import { DayView } from "./day-view";
import { WeekView } from "./week-view";

const LEGEND: ServiceKey[] = ["ot", "aide", "speech", "sped"];
const iso = (date: Date) => format(date, "yyyy-MM-dd");
const mondayOf = (date: string) => iso(startOfWeek(parseISO(date), { weekStartsOn: 1 }));

export function ScheduleScreen({
  data,
  isTherapist,
}: {
  data: SchedulePageData;
  isTherapist: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const { view, date, today } = data;

  const go = (next: { view?: "day" | "week"; date?: string }) => {
    const v = next.view ?? view;
    const d = next.date ?? date;
    startTransition(() =>
      router.replace(`/schedule?view=${v}&date=${d}` as Route, { scroll: false }),
    );
  };

  // Step to the next or previous open day; closed days are skipped.
  const step = (direction: 1 | -1) => {
    if (view === "week") return go({ date: iso(addDays(parseISO(date), direction * 7)) });
    let next = parseISO(date);
    for (let i = 0; i < 7; i++) {
      next = addDays(next, direction);
      if (next.getDay() !== 0) break;
    }
    go({ date: iso(next) });
  };

  const isCurrent = view === "day" ? date === today : mondayOf(date) === mondayOf(today);
  const monday = parseISO(mondayOf(date));
  const saturday = addDays(monday, 5);
  const heading =
    view === "day"
      ? format(parseISO(date), "EEE, MMM d, yyyy")
      : monday.getMonth() === saturday.getMonth()
        ? `${format(monday, "MMM d")} – ${format(saturday, "d, yyyy")}`
        : `${format(monday, "MMM d")} – ${format(saturday, "MMM d, yyyy")}`;

  return (
    <Page className="gap-4">
      <h1 className="sr-only">{isTherapist ? "My schedule" : "Schedule"}</h1>
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup
          type="single"
          variant="segment"
          size="sm"
          aria-label="Schedule view"
          value={view}
          onValueChange={(next) => next && go({ view: next as "day" | "week" })}
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
            onClick={() => go({ date: today })}
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
      <div className={cn("transition-opacity", pending && "opacity-60")} aria-busy={pending}>
        {data.day && <DayView day={data.day} nowIso={data.nowIso} isToday={date === today} />}
        {data.week && (
          <WeekView
            week={data.week}
            today={today}
            onOpenDay={(d) => go({ view: "day", date: d })}
          />
        )}
      </div>
    </Page>
  );
}
