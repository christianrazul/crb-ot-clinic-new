import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { branches, patients, sessionTypes, staff } from "./clinic";
import { createdAt, id, updatedAt } from "./columns";
import { appointmentStatusEnum } from "./enums";

/** "Every Monday at 9:00 until cancelled." Appointments are materialized from it. */
export const appointmentSeries = pgTable(
  "appointment_series",
  {
    id: id(),
    branchId: text()
      .notNull()
      .references(() => branches.id),
    patientId: text()
      .notNull()
      .references(() => patients.id),
    staffId: text()
      .notNull()
      .references(() => staff.id),
    sessionTypeId: text()
      .notNull()
      .references(() => sessionTypes.id),
    /** 0 = Sunday ... 6 = Saturday */
    weekday: smallint().notNull(),
    startHour: smallint().notNull(),
    startsOn: date({ mode: "string" }).notNull(),
    endsOn: date({ mode: "string" }),
    /** Appointments exist up to and including this date. */
    materializedUntil: date({ mode: "string" }).notNull(),
    createdByUserId: text().references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.branchId),
    index().on(t.patientId),
    index().on(t.staffId),
    index().on(t.sessionTypeId),
    check("series_weekday", sql`${t.weekday} between 0 and 6`),
    check("series_hour", sql`${t.startHour} between 0 and 23`),
    check("series_dates", sql`${t.endsOn} is null or ${t.endsOn} >= ${t.startsOn}`),
  ],
);

export const appointments = pgTable(
  "appointments",
  {
    id: id(),
    branchId: text()
      .notNull()
      .references(() => branches.id),
    patientId: text()
      .notNull()
      .references(() => patients.id),
    staffId: text()
      .notNull()
      .references(() => staff.id),
    sessionTypeId: text()
      .notNull()
      .references(() => sessionTypes.id),
    seriesId: text().references(() => appointmentSeries.id),
    startsAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    endsAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    status: appointmentStatusEnum().notNull().default("scheduled"),
    rescheduledToId: text().references((): AnyPgColumn => appointments.id),
    isMakeUp: boolean().notNull().default(false),
    /** Session type rate when booked. Later rate changes never touch it. */
    feeCentavos: integer().notNull(),
    /** Rate class rate and share when marked attended, for payroll. */
    payrollRateCentavos: integer(),
    payrollSharePct: smallint(),
    statusChangedByUserId: text().references(() => users.id),
    statusChangedAt: timestamp({ withTimezone: true, mode: "date" }),
    createdByUserId: text().references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.branchId, t.startsAt),
    index("appointments_staff_starts_idx").on(t.staffId, t.startsAt),
    index("appointments_patient_starts_idx").on(t.patientId, t.startsAt),
    index().on(t.sessionTypeId),
    index().on(t.seriesId),
    index().on(t.rescheduledToId),
    index().on(t.statusChangedByUserId),
    index().on(t.createdByUserId),
    check("appointments_ends_after_start", sql`${t.endsAt} > ${t.startsAt}`),
    // Asia/Manila is a whole-hour offset, so "on the hour" in UTC is on the hour locally.
    check(
      "appointments_on_the_hour",
      sql`extract(minute from ${t.startsAt}) = 0 and extract(second from ${t.startsAt}) = 0`,
    ),
    check("appointments_fee_positive", sql`${t.feeCentavos} >= 0`),
    check(
      "appointments_payroll_snapshot",
      sql`(${t.status} <> 'attended') or (${t.payrollRateCentavos} is not null and ${t.payrollSharePct} is not null)`,
    ),
  ],
);

/** Append-only: an edit is a new row that supersedes the old one. */
export const sessionNotes = pgTable(
  "session_notes",
  {
    id: id(),
    appointmentId: text()
      .notNull()
      .references(() => appointments.id),
    patientId: text()
      .notNull()
      .references(() => patients.id),
    authorStaffId: text()
      .notNull()
      .references(() => staff.id),
    body: text().notNull(),
    version: integer().notNull().default(1),
    supersedesId: text().references((): AnyPgColumn => sessionNotes.id),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.appointmentId),
    index().on(t.patientId, t.createdAt),
    index().on(t.authorStaffId),
    index().on(t.supersedesId),
    check("session_notes_body", sql`length(trim(${t.body})) > 0`),
  ],
);
