import "server-only";

import { addDays, addWeeks, format, parseISO } from "date-fns";
import { and, asc, eq, gte, inArray, isNull, lt, ne, notInArray, or } from "drizzle-orm";

import { bookableHours, eligibleStaff, hourLabel } from "@/lib/booking";
import { fromManilaLocal, manilaHour, manilaWeekday, toManilaIsoDate } from "@/lib/dates";
import type { ServiceKey } from "@/lib/services";
import { bookingInput } from "@/lib/validation/booking";
import type { Actor } from "@/server/auth/actor";
import { assertCan, can } from "@/server/auth/permissions";
import { clinicNow, clinicToday } from "@/server/clock";
import type { DbExecutor } from "@/server/db/client";
import { writeAudit } from "@/server/db/queries/audit";
import { listSessionTypes } from "@/server/db/queries/session-types";
import {
  appointmentSeries,
  appointments,
  branches,
  guardians,
  patients,
  payments,
  rateClasses,
  sessionTypes,
  staff,
  users,
} from "@/server/db/schema";

import { NotFoundError, ValidationError } from "./errors";

/** Recurring bookings are materialized this far ahead; the daily job keeps it rolling. */
export const HORIZON_WEEKS = 8;
const HOLDS_SLOT = ["scheduled", "checked_in", "attended", "no_show"] as const;
const ONE_HOUR = 60 * 60 * 1000;
const slotStart = (date: string, hour: number) =>
  fromManilaLocal(date, `${String(hour).padStart(2, "0")}:00`);
const shortDate = (date: string) => format(parseISO(date), "EEE, MMM d");

/** The colour of a session: the staff member's rate class, so OT Aide shows pink. */
function serviceOf(typeService: ServiceKey | null, rateService: ServiceKey): ServiceKey {
  if (!typeService) return "none";
  return rateService === "aide" ? "aide" : typeService;
}

async function branchOrThrow(db: DbExecutor, branchId: string) {
  const [branch] = await db.select().from(branches).where(eq(branches.id, branchId));
  if (!branch) throw new NotFoundError("That branch no longer exists.");
  return branch;
}

/** Appointments with everything the schedule shows, for a time range at a branch. */
async function appointmentsInRange(
  db: DbExecutor,
  branchId: string,
  from: Date,
  to: Date,
  staffId?: string | null,
) {
  return db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      status: appointments.status,
      staffId: appointments.staffId,
      patientId: appointments.patientId,
      seriesId: appointments.seriesId,
      isMakeUp: appointments.isMakeUp,
      firstName: patients.firstName,
      lastName: patients.lastName,
      sessionTypeName: sessionTypes.name,
      typeService: sessionTypes.service,
      rateService: rateClasses.service,
      paid: payments.id,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(sessionTypes, eq(appointments.sessionTypeId, sessionTypes.id))
    .innerJoin(staff, eq(appointments.staffId, staff.id))
    .innerJoin(rateClasses, eq(staff.rateClassId, rateClasses.id))
    .leftJoin(payments, eq(payments.appointmentId, appointments.id))
    .where(
      and(
        eq(appointments.branchId, branchId),
        gte(appointments.startsAt, from),
        lt(appointments.startsAt, to),
        staffId ? eq(appointments.staffId, staffId) : undefined,
      ),
    )
    .orderBy(asc(appointments.startsAt), asc(appointments.createdAt))
    .then((rows) =>
      rows.map((r) => ({
        id: r.id,
        startsAt: r.startsAt.toISOString(),
        date: toManilaIsoDate(r.startsAt),
        hour: manilaHour(r.startsAt),
        status: r.status,
        staffId: r.staffId,
        patientId: r.patientId,
        patientName: `${r.firstName} ${r.lastName}`,
        patientShort: `${r.firstName} ${r.lastName[0] ?? ""}.`,
        sessionTypeName: r.sessionTypeName,
        service: serviceOf(r.typeService, r.rateService),
        recurring: Boolean(r.seriesId),
        isMakeUp: r.isMakeUp,
        paid: Boolean(r.paid),
      })),
    );
}

export type ScheduleAppointment = Awaited<ReturnType<typeof appointmentsInRange>>[number];

/** Staff columns for the schedule. Therapists only see themselves. */
async function scheduleColumns(db: DbExecutor, actor: Actor, branchId: string) {
  const rows = await db
    .select({
      id: staff.id,
      surname: staff.surname,
      displayName: staff.displayName,
      shortName: staff.shortName,
      rateClassShort: rateClasses.shortName,
      service: rateClasses.service,
    })
    .from(staff)
    .innerJoin(rateClasses, eq(staff.rateClassId, rateClasses.id))
    .where(
      and(
        eq(staff.branchId, branchId),
        eq(staff.active, true),
        isNull(staff.deletedAt),
        actor.role === "therapist" ? eq(staff.id, actor.staffId ?? "none") : undefined,
      ),
    )
    .orderBy(asc(staff.sortOrder));
  return rows;
}

export async function getDaySchedule(
  db: DbExecutor,
  actor: Actor,
  input: { branchId: string; date: string },
) {
  assertCan(actor, "schedule:read", { branchId: input.branchId });
  const branch = await branchOrThrow(db, input.branchId);
  const from = slotStart(input.date, 0);
  const to = slotStart(format(addDays(parseISO(input.date), 1), "yyyy-MM-dd"), 0);
  const [columns, items] = await Promise.all([
    scheduleColumns(db, actor, input.branchId),
    appointmentsInRange(
      db,
      input.branchId,
      from,
      to,
      actor.role === "therapist" ? (actor.staffId ?? "none") : null,
    ),
  ]);
  return {
    date: input.date,
    open: branch.openDays.includes(manilaWeekday(slotStart(input.date, 12))),
    hours: bookableHours(branch.opensAtHour, branch.closesAtHour),
    opensAtHour: branch.opensAtHour,
    columns,
    appointments: items,
    canBook: can(actor, "appointment:book", { branchId: input.branchId }),
  };
}

export async function getWeekSchedule(
  db: DbExecutor,
  actor: Actor,
  input: { branchId: string; monday: string },
) {
  assertCan(actor, "schedule:read", { branchId: input.branchId });
  const branch = await branchOrThrow(db, input.branchId);
  const days = Array.from({ length: 7 }, (_, i) =>
    format(addDays(parseISO(input.monday), i), "yyyy-MM-dd"),
  ).filter((d) => branch.openDays.includes(manilaWeekday(slotStart(d, 12))));
  const from = slotStart(input.monday, 0);
  const to = slotStart(format(addDays(parseISO(input.monday), 7), "yyyy-MM-dd"), 0);
  const items = await appointmentsInRange(
    db,
    input.branchId,
    from,
    to,
    actor.role === "therapist" ? (actor.staffId ?? "none") : null,
  );
  return {
    monday: input.monday,
    days,
    hours: bookableHours(branch.opensAtHour, branch.closesAtHour),
    appointments: items.filter((a) => (HOLDS_SLOT as readonly string[]).includes(a.status)),
  };
}

/** What the booking dialog offers: active session types, eligible staff and the branch's hours. */
export async function getBookingOptions(db: DbExecutor, actor: Actor, branchId: string) {
  assertCan(actor, "appointment:book", { branchId });
  const branch = await branchOrThrow(db, branchId);
  const [types, staffRows] = await Promise.all([
    listSessionTypes(db, { branchId }),
    db
      .select({
        id: staff.id,
        displayName: staff.displayName,
        rateClassId: staff.rateClassId,
        service: rateClasses.service,
        active: staff.active,
      })
      .from(staff)
      .innerJoin(rateClasses, eq(staff.rateClassId, rateClasses.id))
      .where(and(eq(staff.branchId, branchId), eq(staff.active, true), isNull(staff.deletedAt)))
      .orderBy(asc(staff.sortOrder)),
  ]);
  return {
    branch: {
      id: branch.id,
      name: branch.name,
      openDays: branch.openDays,
      opensAtHour: branch.opensAtHour,
      closesAtHour: branch.closesAtHour,
    },
    sessionTypes: types.map((t) => ({
      id: t.id,
      name: t.name,
      service: t.service,
      rateCentavos: t.rateCentavos,
      allowedRateClassIds: t.allowedRateClassIds,
    })),
    staff: staffRows,
  };
}
export type BookingOptions = Awaited<ReturnType<typeof getBookingOptions>>;

function occurrences(date: string, recurring: boolean) {
  if (!recurring) return [date];
  return Array.from({ length: HORIZON_WEEKS }, (_, w) =>
    format(addWeeks(parseISO(date), w), "yyyy-MM-dd"),
  );
}

/**
 * Books one session or a weekly series. Checks every rule and explains the
 * first one broken; the database's exclusion constraints back up the overlap
 * checks if two people book the same slot at the same moment.
 */
export async function bookAppointment(
  db: DbExecutor,
  actor: Actor,
  input: { branchId: string; values: unknown },
) {
  assertCan(actor, "appointment:book", { branchId: input.branchId });
  const v = bookingInput.parse(input.values);
  const branch = await branchOrThrow(db, input.branchId);
  // Only this branch's session types can be booked here.
  const [type] = await listSessionTypes(db, { branchId: input.branchId }).then((all) =>
    all.filter((t) => t.id === v.sessionTypeId),
  );
  if (!type) throw new ValidationError("That session type is no longer offered. Pick another.");
  const [member] = await db
    .select()
    .from(staff)
    .where(and(eq(staff.id, v.staffId), eq(staff.branchId, input.branchId)));
  if (!member || !member.active || member.deletedAt)
    throw new ValidationError("Choose a therapist from this branch.");
  if (!eligibleStaff([member], type.allowedRateClassIds).length) {
    const [rc] = await db.select().from(rateClasses).where(eq(rateClasses.id, member.rateClassId));
    throw new ValidationError(
      `${member.displayName} (${rc?.name ?? "this role"}) can't run ${type.name.toLowerCase()}s. Pick another therapist.`,
    );
  }
  if (v.hour < branch.opensAtHour || v.hour + 1 > branch.closesAtHour) {
    throw new ValidationError(
      `Sessions at ${branch.name} run from ${hourLabel(branch.opensAtHour)} to ${hourLabel(branch.closesAtHour - 1)}.`,
    );
  }

  let original: typeof appointments.$inferSelect | undefined;
  if (v.rescheduleFromId) {
    [original] = await db
      .select()
      .from(appointments)
      .where(eq(appointments.id, v.rescheduleFromId));
    if (!original || original.branchId !== input.branchId) throw new NotFoundError();
    if (!["scheduled", "checked_in"].includes(original.status)) {
      throw new ValidationError("Only upcoming sessions can be rescheduled.");
    }
  }

  let patientId = original?.patientId ?? v.patientId;
  let patientName = v.newPatientName?.trim() || "This patient";
  if (patientId) {
    const [patient] = await db.select().from(patients).where(eq(patients.id, patientId));
    if (patient) patientName = `${patient.firstName} ${patient.lastName}`;
    if (!patient || patient.deletedAt || patient.branchId !== input.branchId)
      throw new ValidationError("Choose a patient from this branch.");
    if (patient.status !== "active") {
      throw new ValidationError(
        `${patient.firstName} ${patient.lastName} is inactive and can't be booked. Set them active first.`,
      );
    }
  }

  const dates = occurrences(v.date, v.recurring && !v.rescheduleFromId);
  const today = clinicToday();
  if (dates[0]! < today) throw new ValidationError("That date has passed. Pick today or later.");
  for (const date of dates) {
    const startsAt = slotStart(date, v.hour);
    if (!branch.openDays.includes(manilaWeekday(startsAt))) {
      throw new ValidationError(
        `${branch.name} is closed on ${format(parseISO(date), "EEEE")}s. Pick another day.`,
      );
    }
    const clashes = await db
      .select({ staffId: appointments.staffId, patientId: appointments.patientId })
      .from(appointments)
      .where(
        and(
          eq(appointments.startsAt, startsAt),
          inArray(appointments.status, [...HOLDS_SLOT]),
          or(
            eq(appointments.staffId, v.staffId),
            patientId ? eq(appointments.patientId, patientId) : undefined,
          ),
          v.rescheduleFromId ? ne(appointments.id, v.rescheduleFromId) : undefined,
        ),
      );
    if (clashes.some((c) => c.staffId === v.staffId)) {
      throw new ValidationError(
        `${member.surname} already has a session at ${hourLabel(v.hour)} on ${shortDate(date)}. Pick another time or therapist.`,
      );
    }
    if (clashes.length)
      throw new ValidationError(
        `${patientName} already has a session at ${hourLabel(v.hour)} on ${shortDate(date)}.`,
      );
  }

  if (!patientId) {
    const name = v.newPatientName!.trim();
    const [firstName = name, ...rest] = name.split(/\s+/);
    const [created] = await db
      .insert(patients)
      .values({
        branchId: input.branchId,
        firstName,
        lastName: rest.join(" ") || "-",
        service: type.service ?? "ot",
        enrolledOn: today,
        primaryStaffId: v.staffId,
        goalsNotes: "New patient. Intake pending.",
      })
      .returning();
    patientId = created!.id;
    await writeAudit(db, {
      actorUserId: actor.userId,
      action: "patient.create",
      entity: "patient",
      entityId: patientId,
      after: { name, via: "booking" },
      ip: actor.ip,
    });
  }

  let seriesId: string | null = null;
  if (v.recurring && !v.rescheduleFromId) {
    const [series] = await db
      .insert(appointmentSeries)
      .values({
        branchId: input.branchId,
        patientId,
        staffId: v.staffId,
        sessionTypeId: type.id,
        weekday: manilaWeekday(slotStart(v.date, v.hour)),
        startHour: v.hour,
        startsOn: v.date,
        materializedUntil: dates.at(-1)!,
        createdByUserId: actor.userId,
      })
      .returning();
    seriesId = series!.id;
  }

  // Free the original's slot first, so a make-up at the same hour (another
  // therapist, say) doesn't collide with the session it replaces.
  if (original) {
    await db
      .update(appointments)
      .set({
        status: "rescheduled",
        statusChangedByUserId: actor.userId,
        statusChangedAt: clinicNow(),
      })
      .where(eq(appointments.id, original.id));
  }

  const created = await db
    .insert(appointments)
    .values(
      dates.map((date) => {
        const startsAt = slotStart(date, v.hour);
        return {
          branchId: input.branchId,
          patientId: patientId!,
          staffId: v.staffId,
          sessionTypeId: type.id,
          seriesId,
          startsAt,
          endsAt: new Date(startsAt.getTime() + ONE_HOUR),
          // Snapshot of the rate when booked.
          feeCentavos: type.rateCentavos,
          isMakeUp: Boolean(v.rescheduleFromId),
          createdByUserId: actor.userId,
        };
      }),
    )
    .returning({ id: appointments.id });

  if (original) {
    await db
      .update(appointments)
      .set({ rescheduledToId: created[0]!.id })
      .where(eq(appointments.id, original.id));
  }
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: original ? "appointment.reschedule" : "appointment.book",
    entity: "appointment",
    entityId: created[0]!.id,
    before: original ? { id: original.id, startsAt: original.startsAt } : undefined,
    after: { ...v, patientId, seriesId, count: created.length },
    ip: actor.ip,
  });
  return { appointmentIds: created.map((c) => c.id), seriesId, patientId };
}

/**
 * "This and all future sessions": ends the weekly series the day before this
 * session and cancels this and every later scheduled session in it.
 */
export async function cancelSeriesFrom(
  db: DbExecutor,
  actor: Actor,
  input: { appointmentId: string },
) {
  const [target] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, input.appointmentId));
  if (!target) throw new NotFoundError();
  assertCan(actor, "appointment:status", { branchId: target.branchId });
  if (!target.seriesId) throw new ValidationError("This session is not part of a weekly booking.");
  const date = toManilaIsoDate(target.startsAt);
  await db
    .update(appointmentSeries)
    .set({ endsOn: format(addDays(parseISO(date), -1), "yyyy-MM-dd") })
    .where(eq(appointmentSeries.id, target.seriesId));
  const cancelled = await db
    .update(appointments)
    .set({ status: "cancelled", statusChangedByUserId: actor.userId, statusChangedAt: clinicNow() })
    .where(
      and(
        eq(appointments.seriesId, target.seriesId),
        gte(appointments.startsAt, target.startsAt),
        inArray(appointments.status, ["scheduled", "checked_in"]),
      ),
    )
    .returning({ id: appointments.id });
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "appointment.cancel_series",
    entity: "appointment_series",
    entityId: target.seriesId,
    after: { from: date, cancelled: cancelled.map((c) => c.id) },
    ip: actor.ip,
  });
  return { cancelled: cancelled.length };
}

/** Everything the session dialog shows about one appointment. */
export async function getAppointmentDetail(db: DbExecutor, actor: Actor, appointmentId: string) {
  const [row] = await db
    .select({
      appointment: appointments,
      patient: patients,
      staffMember: staff,
      rateService: rateClasses.service,
      typeName: sessionTypes.name,
      typeService: sessionTypes.service,
      paymentId: payments.id,
      changedBy: users.name,
    })
    .from(appointments)
    .innerJoin(patients, eq(appointments.patientId, patients.id))
    .innerJoin(staff, eq(appointments.staffId, staff.id))
    .innerJoin(rateClasses, eq(staff.rateClassId, rateClasses.id))
    .innerJoin(sessionTypes, eq(appointments.sessionTypeId, sessionTypes.id))
    .leftJoin(payments, eq(payments.appointmentId, appointments.id))
    .leftJoin(users, eq(users.id, appointments.statusChangedByUserId))
    .where(eq(appointments.id, appointmentId));
  if (!row) throw new NotFoundError();
  const own = actor.role !== "therapist" || row.appointment.staffId === actor.staffId;
  if (!own) throw new NotFoundError();
  assertCan(actor, "schedule:read", { branchId: row.appointment.branchId, ownedByActor: own });
  const [guardian] = await db
    .select()
    .from(guardians)
    .where(and(eq(guardians.patientId, row.patient.id), eq(guardians.isPrimary, true)));
  const isTherapist = actor.role === "therapist";
  return {
    id: row.appointment.id,
    branchId: row.appointment.branchId,
    startsAt: row.appointment.startsAt.toISOString(),
    status: row.appointment.status,
    recurring: Boolean(row.appointment.seriesId),
    isMakeUp: row.appointment.isMakeUp,
    patient: {
      id: row.patient.id,
      name: `${row.patient.firstName} ${row.patient.lastName}`,
      recurringSlot: row.patient.recurringSlot,
    },
    staffName: row.staffMember.shortName,
    staffId: row.staffMember.id,
    sessionTypeName: row.typeName,
    service: serviceOf(row.typeService, row.rateService),
    // Therapists never see money.
    feeCentavos: isTherapist ? null : row.appointment.feeCentavos,
    paid: isTherapist ? null : Boolean(row.paymentId),
    guardian: guardian
      ? { name: guardian.name, relationship: guardian.relationship, phone: guardian.phone }
      : null,
    statusChangedBy: row.changedBy,
    statusChangedAt: row.appointment.statusChangedAt?.toISOString() ?? null,
  };
}
export type AppointmentDetail = Awaited<ReturnType<typeof getAppointmentDetail>>;

/**
 * The daily job: extends every open series so appointments always exist
 * HORIZON_WEEKS ahead. Slots that are already taken are skipped and reported,
 * never double-booked.
 */
export async function materializeSeries(db: DbExecutor, options: { today?: string } = {}) {
  const today = options.today ?? clinicToday();
  const horizon = format(addWeeks(parseISO(today), HORIZON_WEEKS), "yyyy-MM-dd");
  const open = await db
    .select({
      series: appointmentSeries,
      rateCentavos: sessionTypes.rateCentavos,
      active: sessionTypes.active,
      patientStatus: patients.status,
      patientDeleted: patients.deletedAt,
    })
    .from(appointmentSeries)
    .innerJoin(sessionTypes, eq(appointmentSeries.sessionTypeId, sessionTypes.id))
    .innerJoin(patients, eq(appointmentSeries.patientId, patients.id))
    .where(
      and(
        lt(appointmentSeries.materializedUntil, horizon),
        or(isNull(appointmentSeries.endsOn), gte(appointmentSeries.endsOn, today)),
      ),
    );
  let created = 0;
  const skipped: { seriesId: string; date: string }[] = [];
  for (const { series, rateCentavos, active, patientStatus, patientDeleted } of open) {
    if (!active || patientStatus !== "active" || patientDeleted) continue;
    let date = format(addWeeks(parseISO(series.materializedUntil), 1), "yyyy-MM-dd");
    const last = series.endsOn && series.endsOn < horizon ? series.endsOn : horizon;
    while (date <= last) {
      const startsAt = slotStart(date, series.startHour);
      const taken = await db
        .select({ id: appointments.id })
        .from(appointments)
        .where(
          and(
            eq(appointments.startsAt, startsAt),
            notInArray(appointments.status, ["cancelled", "rescheduled"]),
            or(
              eq(appointments.staffId, series.staffId),
              eq(appointments.patientId, series.patientId),
            ),
          ),
        );
      if (taken.length) skipped.push({ seriesId: series.id, date });
      else {
        await db.insert(appointments).values({
          branchId: series.branchId,
          patientId: series.patientId,
          staffId: series.staffId,
          sessionTypeId: series.sessionTypeId,
          seriesId: series.id,
          startsAt,
          endsAt: new Date(startsAt.getTime() + ONE_HOUR),
          feeCentavos: rateCentavos,
        });
        created += 1;
      }
      date = format(addWeeks(parseISO(date), 1), "yyyy-MM-dd");
    }
    await db
      .update(appointmentSeries)
      .set({ materializedUntil: last })
      .where(eq(appointmentSeries.id, series.id));
  }
  return { created, skipped };
}
