import "server-only";

import { format, parseISO, startOfWeek } from "date-fns";
import { z } from "zod";

import { clinicNow, clinicToday } from "@/server/clock";
import { getDb } from "@/server/db/client";
import { getDaySchedule, getWeekSchedule } from "@/server/services/scheduling";
import type { ShellSession } from "@/server/session/shell";

export const scheduleParams = z.object({
  view: z.enum(["day", "week"]).catch("day"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
});

const mondayOf = (date: string) =>
  format(startOfWeek(parseISO(date), { weekStartsOn: 1 }), "yyyy-MM-dd");

export async function loadSchedulePage(session: ShellSession, raw: unknown) {
  const params = scheduleParams.parse(raw);
  const today = clinicToday();
  const date = params.date ?? today;
  const db = getDb();
  const common = { today, nowIso: clinicNow().toISOString(), date, view: params.view };
  if (params.view === "week") {
    return {
      ...common,
      week: await getWeekSchedule(db, session.actor, {
        branchId: session.branch.id,
        monday: mondayOf(date),
      }),
      day: null,
    };
  }
  return {
    ...common,
    day: await getDaySchedule(db, session.actor, { branchId: session.branch.id, date }),
    week: null,
  };
}

export type SchedulePageData = Awaited<ReturnType<typeof loadSchedulePage>>;
