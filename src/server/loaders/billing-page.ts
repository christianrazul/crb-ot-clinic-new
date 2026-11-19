import "server-only";

import { z } from "zod";

import { clinicToday } from "@/server/clock";
import { getDb } from "@/server/db/client";
import { getBillingDay } from "@/server/services/payments";
import type { ShellSession } from "@/server/session/shell";

export const billingParams = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
});

/** The billing day: today unless a past (or other) day is picked, to backlog payments. */
export async function loadBillingPage(session: ShellSession, raw: unknown = {}) {
  const today = clinicToday();
  const date = billingParams.parse(raw).date ?? today;
  return {
    date,
    today,
    ...(await getBillingDay(getDb(), session.actor, { branchId: session.branch.id, date })),
  };
}
export type BillingPageData = Awaited<ReturnType<typeof loadBillingPage>>;
