import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { createdAt, id, updatedAt } from "./columns";
import { genderEnum, patientServiceEnum, patientStatusEnum, serviceEnum } from "./enums";

export const branches = pgTable(
  "branches",
  {
    id: id(),
    code: text().notNull().unique(),
    name: text().notNull().unique(),
    location: text().notNull(),
    isMain: boolean().notNull().default(false),
    /** Sessions are one hour and start on the hour, so hours are enough. */
    opensAtHour: smallint().notNull().default(9),
    closesAtHour: smallint().notNull().default(17),
    /** 0 = Sunday ... 6 = Saturday */
    openDays: smallint()
      .array()
      .notNull()
      .default(sql`'{1,2,3,4,5,6}'`),
    timezone: text().notNull().default("Asia/Manila"),
    receiptPrefix: text().notNull().default("CRB"),
    /** Flag a patient when their advance credit falls under this. */
    lowCreditThresholdCentavos: integer().notNull().default(100_000),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      "branches_hours_valid",
      sql`${t.opensAtHour} >= 0 and ${t.closesAtHour} <= 24 and ${t.opensAtHour} < ${t.closesAtHour}`,
    ),
    check("branches_open_days_valid", sql`${t.openDays} <@ '{0,1,2,3,4,5,6}'::smallint[]`),
  ],
);

export const rateClasses = pgTable("rate_classes", {
  id: id(),
  name: text().notNull().unique(),
  shortName: text().notNull(),
  service: serviceEnum().notNull(),
  sortOrder: smallint().notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** The share of each session's fee a role's therapist earns at a branch. */
export const branchRates = pgTable(
  "branch_rates",
  {
    branchId: text()
      .notNull()
      .references(() => branches.id),
    rateClassId: text()
      .notNull()
      .references(() => rateClasses.id),
    therapistSharePct: smallint().notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [
    primaryKey({ columns: [t.branchId, t.rateClassId] }),
    index().on(t.rateClassId),
    check("branch_rates_share_pct", sql`${t.therapistSharePct} between 0 and 100`),
  ],
);

export const staff = pgTable(
  "staff",
  {
    id: id(),
    userId: text()
      .unique()
      .references(() => users.id),
    branchId: text()
      .notNull()
      .references(() => branches.id),
    displayName: text().notNull(),
    shortName: text().notNull(),
    surname: text().notNull(),
    rateClassId: text()
      .notNull()
      .references(() => rateClasses.id),
    active: boolean().notNull().default(true),
    /** Column order on the schedule and in tables. */
    sortOrder: smallint().notNull().default(0),
    deletedAt: timestamp({ withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.branchId), index().on(t.rateClassId)],
);

export const sessionTypes = pgTable(
  "session_types",
  {
    id: id(),
    /** Each branch keeps its own list and prices. */
    branchId: text()
      .notNull()
      .references(() => branches.id),
    name: text().notNull(),
    /** Null for uncategorized types such as make up sessions. */
    service: patientServiceEnum(),
    rateCentavos: integer().notNull(),
    /** When true any rate class may run it; otherwise see session_type_rate_classes. */
    anyRateClass: boolean().notNull().default(false),
    active: boolean().notNull().default(true),
    sortOrder: smallint().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("session_types_branch_name").on(t.branchId, t.name),
    check("session_types_rate_positive", sql`${t.rateCentavos} >= 0`),
  ],
);

export const sessionTypeRateClasses = pgTable(
  "session_type_rate_classes",
  {
    sessionTypeId: text()
      .notNull()
      .references(() => sessionTypes.id, { onDelete: "cascade" }),
    rateClassId: text()
      .notNull()
      .references(() => rateClasses.id),
  },
  (t) => [primaryKey({ columns: [t.sessionTypeId, t.rateClassId] }), index().on(t.rateClassId)],
);

export const patients = pgTable(
  "patients",
  {
    id: id(),
    branchId: text()
      .notNull()
      .references(() => branches.id),
    firstName: text().notNull(),
    lastName: text().notNull(),
    dateOfBirth: date({ mode: "string" }),
    gender: genderEnum().notNull().default("unspecified"),
    diagnosis: text().notNull().default(""),
    enrolledOn: date({ mode: "string" }).notNull(),
    /** The main service; it colors the patient's avatar. Always one of `services`. */
    service: patientServiceEnum().notNull(),
    /** Every service the patient receives, the main one included. */
    services: patientServiceEnum()
      .array()
      .notNull()
      .default(sql`'{}'`),
    primaryStaffId: text().references(() => staff.id),
    status: patientStatusEnum().notNull().default("active"),
    /** Display label of the weekly booking until series drive it, e.g. "Mon / Wed 9:00". */
    recurringSlot: text().notNull().default("Unscheduled"),
    goalsNotes: text().notNull().default(""),
    deletedAt: timestamp({ withTimezone: true, mode: "date" }),
    anonymizedAt: timestamp({ withTimezone: true, mode: "date" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.branchId),
    index().on(t.primaryStaffId),
    index("patients_name_idx").on(sql`lower(${t.lastName})`, sql`lower(${t.firstName})`),
    check("patients_services_include_main", sql`${t.service} = any(${t.services})`),
  ],
);

export const patientBackupStaff = pgTable(
  "patient_backup_staff",
  {
    patientId: text()
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    staffId: text()
      .notNull()
      .references(() => staff.id),
  },
  (t) => [primaryKey({ columns: [t.patientId, t.staffId] }), index().on(t.staffId)],
);

export const guardians = pgTable(
  "guardians",
  {
    id: id(),
    patientId: text()
      .notNull()
      .references(() => patients.id, { onDelete: "cascade" }),
    name: text().notNull(),
    relationship: text().notNull().default(""),
    phone: text().notNull().default(""),
    email: text().notNull().default(""),
    isPrimary: boolean().notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.patientId),
    uniqueIndex("guardians_one_primary")
      .on(t.patientId)
      .where(sql`${t.isPrimary}`),
  ],
);

/** Clinic-wide settings, a single row (id = 'clinic'). */
export const clinicSettings = pgTable(
  "clinic_settings",
  {
    id: text().primaryKey().default("clinic"),
    updatedAt: updatedAt(),
  },
  (t) => [check("clinic_settings_singleton", sql`${t.id} = 'clinic'`)],
);
