import "server-only";

import { and, asc, desc, eq, gte, lt } from "drizzle-orm";

import type { DbExecutor } from "../client";
import { appointments, sessionNotes } from "../schema";

export type AppointmentRow = typeof appointments.$inferSelect;
export type NewAppointment = typeof appointments.$inferInsert;

/** Appointments in [from, to) at a branch, optionally for one staff member. */
export function listAppointments(
  db: DbExecutor,
  range: { branchId: string; from: Date; to: Date; staffId?: string | null },
) {
  return db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.branchId, range.branchId),
        gte(appointments.startsAt, range.from),
        lt(appointments.startsAt, range.to),
        range.staffId ? eq(appointments.staffId, range.staffId) : undefined,
      ),
    )
    .orderBy(asc(appointments.startsAt), asc(appointments.staffId));
}

export async function getAppointment(db: DbExecutor, id: string) {
  const [row] = await db.select().from(appointments).where(eq(appointments.id, id));
  return row ?? null;
}

/** A patient's appointments, newest first. */
export function patientAppointments(db: DbExecutor, patientId: string, before?: Date) {
  return db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.patientId, patientId),
        before ? lt(appointments.startsAt, before) : undefined,
      ),
    )
    .orderBy(desc(appointments.startsAt));
}

export function insertAppointments(db: DbExecutor, rows: NewAppointment[]) {
  return db.insert(appointments).values(rows).returning();
}

export function notesForPatient(db: DbExecutor, patientId: string) {
  return db
    .select()
    .from(sessionNotes)
    .where(eq(sessionNotes.patientId, patientId))
    .orderBy(desc(sessionNotes.createdAt));
}

export function notesForAppointment(db: DbExecutor, appointmentId: string) {
  return db
    .select()
    .from(sessionNotes)
    .where(eq(sessionNotes.appointmentId, appointmentId))
    .orderBy(desc(sessionNotes.createdAt));
}
