import "server-only";

import { clinicToday } from "@/server/clock";
import { getDb } from "@/server/db/client";
import { getBillingDay } from "@/server/services/payments";
import type { ShellSession } from "@/server/session/shell";

export async function loadBillingPage(session: ShellSession) {
  const date = clinicToday();
  return {
    date,
    ...(await getBillingDay(getDb(), session.actor, { branchId: session.branch.id, date })),
  };
}
export type BillingPageData = Awaited<ReturnType<typeof loadBillingPage>>;
