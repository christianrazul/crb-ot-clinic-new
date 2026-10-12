import "server-only";

import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { and, asc, desc, eq, gte, inArray, lt, notExists, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { z } from "zod";

import { ageOn } from "@/lib/age";
import { fromManilaLocal, toManilaIsoDate } from "@/lib/dates";
import { payrollLine } from "@/lib/payroll";
import type { ServiceKey } from "@/lib/services";
import type { Actor } from "@/server/auth/actor";
import { assertCan, ForbiddenError } from "@/server/auth/permissions";
import { clinicNow, clinicToday } from "@/server/clock";
import type { DbExecutor } from "@/server/db/client";
import { writeAudit } from "@/server/db/queries/audit";
import { rateAt } from "@/server/db/queries/rates";
import {
  appointments,
  branches,
  patients,
  rateClasses,
  sessionNotes,
  sessionTypes,
  staff,
} from "@/server/db/schema";

import { NotFoundError, ValidationError } from "./errors";
import { patientIsVisibleTo } from "./patients";

/** A note counts once a session is checked in or attended; within 24 hours of the end is on time. */
const NOTE_DUE_HOURS = 24;
const noteBody = z
  .string()
  .trim()
  .min(1, "Write the note first.")
  .max(5000, "Keep notes under 5,000 characters.");

const superseding = alias(sessionNotes, "superseding");
/** Only the latest version of each note: no other note supersedes it. */
const isLatest = notExists(
  sql`(select 1 from ${sessionNotes} as superseding where ${superseding.supersedesId} = ${sessionNotes.id})`,
);

function serviceOf(typeService: ServiceKey | null, rateService: ServiceKey): ServiceKey {
  if (!typeService) return "none";
  return rateService === "aide" ? "aide" : typeService;
}

/** Latest-version notes for a patient, newest first, with author names. */
export async function latestNotesForPatient(db: DbExecutor, patientId: string, limit = 50) {
  return db
    .select({
      id: sessionNotes.id,
      appointmentId: sessionNotes.appointmentId,
      body: sessionNotes.body,
      version: sessionNotes.version,
      createdAt: sessionNotes.createdAt,
      authorStaffId: sessionNotes.authorStaffId,
      authorName: staff.shortName,
    })
    .from(sessionNotes)
    .innerJoin(staff, eq(sessionNotes.authorStaffId, staff.id))
    .where(and(eq(sessionNotes.patientId, patientId), isLatest))
    .orderBy(desc(sessionNotes.createdAt))
    .limit(limit)
    .then((rows) => rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })));
}

async function appointmentForNotes(db: DbExecutor, appointmentId: string) {
  const [row] = await db
    .select({
      appointment: appointments,
      patient: patients,
      typeName: sessionTypes.name,
      typeService: sessionTypes.service,
      rateService: rateClasses.service,
      staffName: staff.shortName,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(sessionTypes, eq(appointments.sessionTypeId, sessionTypes.id))
    .innerJoin(staff, eq(appointments.staffId, staff.id))
    .innerJoin(rateClasses, eq(staff.rateClassId, rateClasses.id))
    .where(eq(appointments.id, appointmentId));
  if (!row) throw new NotFoundError();
  return row;
}

/** What the therapist's note dialog shows for one of their sessions. */
export async function getNoteContext(db: DbExecutor, actor: Actor, appointmentId: string) {
  const row = await appointmentForNotes(db, appointmentId);
  const own = actor.role === "therapist" ? row.appointment.staffId === actor.staffId : true;
  if (!own) throw new NotFoundError();
  if (!patientIsVisibleTo(actor, row.patient)) throw new NotFoundError();
  assertCan(actor, "note:read", { branchId: row.appointment.branchId, ownedByActor: own });

  const [toDate] = await db
    .select({
      held: sql<number>`count(*) filter (where ${appointments.status} in ('attended', 'no_show'))`.mapWith(
        Number,
      ),
      attended: sql<number>`count(*) filter (where ${appointments.status} = 'attended')`.mapWith(
        Number,
      ),
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.patientId, row.patient.id),
        lt(appointments.startsAt, row.appointment.endsAt),
      ),
    );
  const notes = await latestNotesForPatient(db, row.patient.id, 2);
  return {
    appointmentId: row.appointment.id,
    startsAt: row.appointment.startsAt.toISOString(),
    status: row.appointment.status,
    sessionTypeName: row.typeName,
    service: serviceOf(row.typeService, row.rateService),
    patient: {
      id: row.patient.id,
      name: `${row.patient.firstName} ${row.patient.lastName}`,
      age: row.patient.dateOfBirth ? ageOn(row.patient.dateOfBirth, clinicToday()) : null,
      diagnosis: row.patient.diagnosis,
      goals: row.patient.goalsNotes,
      recurringSlot: row.patient.recurringSlot,
    },
    sessionsToDate: toDate?.held ?? 0,
    attendancePct: toDate?.held ? Math.round(((toDate.attended ?? 0) / toDate.held) * 100) : null,
    notes,
    canWrite: actor.role === "therapist" && own,
    myStaffId: actor.staffId,
  };
}
export type NoteContext = Awaited<ReturnType<typeof getNoteContext>>;

/** A new note on a therapist's own session. Append-only: never replaces anything. */
export async function addNote(
  db: DbExecutor,
  actor: Actor,
  input: { appointmentId: string; body: unknown },
) {
  const body = noteBody.parse(input.body);
  const row = await appointmentForNotes(db, input.appointmentId);
  const own = row.appointment.staffId === actor.staffId;
  assertCan(actor, "note:write", { branchId: row.appointment.branchId, ownedByActor: own });
  if (!own) throw new ForbiddenError("You can only write notes for your own sessions.");
  if (!["checked_in", "attended"].includes(row.appointment.status)) {
    throw new ValidationError(
      "Notes are for sessions that happened. Ask the desk to check the patient in first.",
    );
  }
  const [note] = await db
    .insert(sessionNotes)
    .values({
      appointmentId: row.appointment.id,
      patientId: row.patient.id,
      authorStaffId: actor.staffId!,
      body,
      createdAt: clinicNow(),
    })
    .returning();
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "note.create",
    entity: "session_note",
    entityId: note!.id,
    after: { appointmentId: row.appointment.id, version: 1 },
    ip: actor.ip,
  });
  return note!;
}

/** Editing writes a new version that supersedes the old one; the old one stays. */
export async function editNote(
  db: DbExecutor,
  actor: Actor,
  input: { noteId: string; body: unknown },
) {
  const body = noteBody.parse(input.body);
  const [previous] = await db.select().from(sessionNotes).where(eq(sessionNotes.id, input.noteId));
  if (!previous) throw new NotFoundError();
  assertCan(actor, "note:write", { ownedByActor: previous.authorStaffId === actor.staffId });
  if (previous.authorStaffId !== actor.staffId)
    throw new ForbiddenError("You can only edit your own notes.");
  const [newer] = await db
    .select({ id: sessionNotes.id })
    .from(sessionNotes)
    .where(eq(sessionNotes.supersedesId, previous.id));
  if (newer)
    throw new ValidationError("This note was already edited. Reload to see the latest version.");
  const [note] = await db
    .insert(sessionNotes)
    .values({
      appointmentId: previous.appointmentId,
      patientId: previous.patientId,
      authorStaffId: previous.authorStaffId,
      body,
      version: previous.version + 1,
      supersedesId: previous.id,
      createdAt: clinicNow(),
    })
    .returning();
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "note.edit",
    entity: "session_note",
    entityId: note!.id,
    before: { id: previous.id, version: previous.version },
    after: { version: note!.version },
    ip: actor.ip,
  });
  return note!;
}

/** One past session and its latest note, for the patient Sessions tab. */
export async function getHistoryDetail(db: DbExecutor, actor: Actor, appointmentId: string) {
  const row = await appointmentForNotes(db, appointmentId);
  if (!patientIsVisibleTo(actor, row.patient)) throw new NotFoundError();
  assertCan(actor, "note:read", { branchId: row.appointment.branchId });
  const [branch] = await db
    .select({ name: branches.name })
    .from(branches)
    .where(eq(branches.id, row.appointment.branchId));
  const [note] = await db
    .select({ body: sessionNotes.body, authorName: staff.shortName, version: sessionNotes.version })
    .from(sessionNotes)
    .innerJoin(staff, eq(sessionNotes.authorStaffId, staff.id))
    .where(and(eq(sessionNotes.appointmentId, appointmentId), isLatest))
    .orderBy(desc(sessionNotes.createdAt))
    .limit(1);
  return {
    startsAt: row.appointment.startsAt.toISOString(),
    status: row.appointment.status,
    sessionTypeName: row.typeName,
    staffName: row.staffName,
    branchName: branch?.name ?? "",
    patient: {
      name: `${row.patient.firstName} ${row.patient.lastName}`,
      service: row.patient.service,
    },
    note: note ?? null,
  };
}
export type HistoryDetail = Awaited<ReturnType<typeof getHistoryDetail>>;

/** Attended sessions without a note, oldest first. Due within 24 hours of the session ending. */
export async function notesDue(db: DbExecutor, staffId: string, now: Date) {
  const since = addDays(now, -30);
  const rows = await db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      endsAt: appointments.endsAt,
      firstName: patients.firstName,
      lastName: patients.lastName,
      service: patients.service,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .where(
      and(
        eq(appointments.staffId, staffId),
        eq(appointments.status, "attended"),
        gte(appointments.startsAt, since),
        lt(appointments.endsAt, now),
        notExists(
          sql`(select 1 from ${sessionNotes} where ${sessionNotes.appointmentId} = ${appointments.id})`,
        ),
      ),
    )
    .orderBy(asc(appointments.startsAt));
  const today = toManilaIsoDate(now);
  return rows.map((r) => {
    const overdue = now.getTime() - r.endsAt.getTime() > NOTE_DUE_HOURS * 60 * 60 * 1000;
    return {
      appointmentId: r.id,
      startsAt: r.startsAt.toISOString(),
      patientName: `${r.firstName} ${r.lastName}`,
      service: r.service,
      daysLate: overdue
        ? Math.max(
            1,
            differenceInCalendarDays(parseISO(today), parseISO(toManilaIsoDate(r.startsAt))),
          )
        : 0,
    };
  });
}

/** The therapist's own day: sessions, notes due, and this month's earnings from payroll snapshots. */
export async function getMyDay(db: DbExecutor, actor: Actor) {
  if (actor.role !== "therapist" || !actor.staffId) throw new ForbiddenError();
  const now = clinicNow();
  const today = clinicToday();
  const tomorrow = format(addDays(parseISO(today), 1), "yyyy-MM-dd");
  const sessions = await db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      status: appointments.status,
      firstName: patients.firstName,
      lastName: patients.lastName,
      dateOfBirth: patients.dateOfBirth,
      goals: patients.goalsNotes,
      typeService: sessionTypes.service,
      rateService: rateClasses.service,
      noteCount:
        sql<number>`(select count(*) from ${sessionNotes} where ${sessionNotes.appointmentId} = ${appointments.id})`.mapWith(
          Number,
        ),
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(sessionTypes, eq(appointments.sessionTypeId, sessionTypes.id))
    .innerJoin(staff, eq(appointments.staffId, staff.id))
    .innerJoin(rateClasses, eq(staff.rateClassId, rateClasses.id))
    .where(
      and(
        eq(appointments.staffId, actor.staffId),
        gte(appointments.startsAt, fromManilaLocal(today, "00:00")),
        lt(appointments.startsAt, fromManilaLocal(tomorrow, "00:00")),
        inArray(appointments.status, ["scheduled", "checked_in", "attended", "no_show"]),
      ),
    )
    .orderBy(asc(appointments.startsAt));

  const monthStart = `${today.slice(0, 7)}-01`;
  const monthRows = await db
    .select({
      startsAt: appointments.startsAt,
      rate: appointments.payrollRateCentavos,
      share: appointments.payrollSharePct,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.staffId, actor.staffId),
        eq(appointments.status, "attended"),
        gte(appointments.startsAt, fromManilaLocal(monthStart, "00:00")),
      ),
    );
  const weeks = [1, 2, 3, 4, 5].map((n) => ({ week: `Wk ${n}`, amount: 0 }));
  let total = 0;
  for (const r of monthRows) {
    const share = payrollLine(1, r.rate ?? 0, r.share ?? 0).therapistShareCentavos;
    total += share;
    const day = Number(toManilaIsoDate(r.startsAt).slice(8, 10));
    weeks[Math.min(4, Math.floor((day - 1) / 7))]!.amount += share;
  }
  const [member] = await db
    .select({ branchId: staff.branchId, rateClassId: staff.rateClassId })
    .from(staff)
    .where(eq(staff.id, actor.staffId));
  const branchRate = member ? await rateAt(db, member.branchId, member.rateClassId) : null;
  const rate = branchRate ? { share: branchRate.share } : undefined;

  return {
    today,
    sessions: sessions.map((s) => ({
      id: s.id,
      startsAt: s.startsAt.toISOString(),
      status: s.status,
      patientName: `${s.firstName} ${s.lastName}`,
      age: s.dateOfBirth ? ageOn(s.dateOfBirth, today) : null,
      focus: s.goals.split(/[.;]/)[0]?.trim() ?? "",
      service: serviceOf(s.typeService, s.rateService),
      noted: s.noteCount > 0,
    })),
    notesDue: await notesDue(db, actor.staffId, now),
    earnings: {
      totalCentavos: total,
      sessions: monthRows.length,
      sharePct: rate?.share ?? 0,
      weekly: weeks.filter((w, i) => i < 4 || w.amount > 0),
      monthLabel: format(parseISO(today), "MMMM yyyy"),
    },
  };
}
export type MyDayData = Awaited<ReturnType<typeof getMyDay>>;
