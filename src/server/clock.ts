import "server-only";

import { env } from "@/env";
import { toManilaIsoDate } from "@/lib/dates";

/**
 * "Now" for the clinic. Development and tests pin it with DEMO_NOW so the
 * seeded demo week is today; production always uses the real clock.
 * Server code must use this, never `new Date()`, for anything date-based.
 */
export function clinicNow(): Date {
  return env.DEMO_NOW ? new Date(env.DEMO_NOW) : new Date();
}

/** Today's date in clinic time, yyyy-MM-dd. */
export function clinicToday(): string {
  return toManilaIsoDate(clinicNow());
}
