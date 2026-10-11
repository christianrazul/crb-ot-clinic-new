import "server-only";

import { clinicNow, clinicToday } from "@/server/clock";
import { getDb } from "@/server/db/client";
import { getDaySchedule } from "@/server/services/scheduling";
import type { ShellSession } from "@/server/session/shell";

/** The front desk's day: every session today at the branch, with payment status. */
export async function loadTodayPage(session: ShellSession) {
  const day = await getDaySchedule(getDb(), session.actor, {
    branchId: session.branch.id,
    date: clinicToday(),
  });
  return { appointments: day.appointments, nowIso: clinicNow().toISOString(), staff: day.columns };
}

export type TodayPageData = Awaited<ReturnType<typeof loadTodayPage>>;
