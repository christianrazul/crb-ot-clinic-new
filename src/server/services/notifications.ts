import "server-only";

import { addDays } from "date-fns";
import { and, count, eq, gte, lt, notExists, sql } from "drizzle-orm";

import { fromManilaLocal } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import type { Actor } from "@/server/auth/actor";
import { can } from "@/server/auth/permissions";
import { clinicNow, clinicToday } from "@/server/clock";
import type { DbExecutor } from "@/server/db/client";
import { appointments, patients, sessionNotes } from "@/server/db/schema";

import { lowCreditPatients } from "./payments";

export type NotificationItem = {
  id: string;
  kind: "low_credit" | "notes_overdue" | "no_shows";
  title: string;
  description: string;
  /** In-app link, by id only. */
  href: string;
};

/** The header's notifications, built from live data and the actor's permissions. */
export async function getNotifications(
  db: DbExecutor,
  actor: Actor,
  branchId: string,
): Promise<NotificationItem[]> {
  if (!actor.branchIds.includes(branchId)) return [];
  const items: NotificationItem[] = [];
  const now = clinicNow();

  if (can(actor, "credit:read", { branchId })) {
    const { threshold, patients: low } = await lowCreditPatients(db, branchId);
    for (const p of low) {
      items.push({
        id: `low-${p.patientId}`,
        kind: "low_credit",
        title: `${p.name}'s credit is low`,
        description: `${formatPeso(p.balanceCentavos)} left, under the ${formatPeso(threshold)} reminder.`,
        href: `/patients?patient=${p.patientId}&tab=credit`,
      });
    }
  }

  // Attended sessions with no note more than 24 hours after they ended.
  const overdueBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [overdue] = await db
    .select({ n: count() })
    .from(appointments)
    .where(
      and(
        eq(appointments.branchId, branchId),
        eq(appointments.status, "attended"),
        gte(appointments.startsAt, addDays(now, -30)),
        lt(appointments.endsAt, overdueBefore),
        actor.role === "therapist" ? eq(appointments.staffId, actor.staffId ?? "none") : undefined,
        notExists(
          sql`(select 1 from ${sessionNotes} where ${sessionNotes.appointmentId} = ${appointments.id})`,
        ),
      ),
    );
  if (overdue?.n) {
    items.push({
      id: "notes-overdue",
      kind: "notes_overdue",
      title: `${overdue.n} session note${overdue.n === 1 ? " is" : "s are"} overdue`,
      description:
        actor.role === "therapist" ? "Add them from My day." : "Therapists add notes from My day.",
      href: actor.role === "therapist" ? "/my-day" : "/schedule",
    });
  }

  if (actor.role !== "therapist") {
    const monthStart = fromManilaLocal(`${clinicToday().slice(0, 7)}-01`, "00:00");
    const rows = await db
      .select({
        patientId: appointments.patientId,
        firstName: patients.firstName,
        lastName: patients.lastName,
        n: count(),
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .where(
        and(
          eq(appointments.branchId, branchId),
          eq(appointments.status, "no_show"),
          gte(appointments.startsAt, monthStart),
        ),
      )
      .groupBy(appointments.patientId, patients.firstName, patients.lastName)
      .having(sql`count(*) >= 2`);
    for (const r of rows) {
      items.push({
        id: `noshow-${r.patientId}`,
        kind: "no_shows",
        title: `${r.firstName} ${r.lastName} missed ${r.n} sessions`,
        description: "This month. Worth a follow-up call.",
        href: `/patients?patient=${r.patientId}&tab=sessions`,
      });
    }
  }
  return items;
}
