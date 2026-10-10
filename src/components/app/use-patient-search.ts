"use client";

import * as React from "react";

import { searchPatientsAction } from "@/app/(app)/patients/actions";
import type { ServiceKey } from "@/lib/services";

export type PatientHit = {
  id: string;
  firstName: string;
  lastName: string;
  service: Exclude<ServiceKey, "aide" | "none">;
  status: "active" | "inactive";
  guardianName: string | null;
  guardianRelationship: string | null;
};

/**
 * Server-side patient search, 200ms after typing stops. `bookableOnly` drops
 * inactive patients, so they never appear when booking.
 */
export function usePatientSearch(
  query: string,
  options: { bookableOnly: boolean; enabled?: boolean },
) {
  const [answer, setAnswer] = React.useState<{ query: string | null; hits: PatientHit[] }>({
    query: null,
    hits: [],
  });
  const enabled = options.enabled ?? true;

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await searchPatientsAction({ query, bookableOnly: options.bookableOnly });
      if (!cancelled) setAnswer({ query, hits: result.ok ? (result.data as PatientHit[]) : [] });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, options.bookableOnly, enabled]);

  // Still loading while the answer on screen is for an older query.
  return { hits: answer.hits, loading: answer.query !== query };
}
