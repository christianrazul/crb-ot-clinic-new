import "server-only";

import { and, asc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import { ageOn } from "@/lib/age";
import { patientFormSchema } from "@/lib/validation/patient";
import type { Actor } from "@/server/auth/actor";
import { assertCan, can, ForbiddenError } from "@/server/auth/permissions";
import { clinicNow, clinicToday } from "@/server/clock";
import type { DbExecutor } from "@/server/db/client";
import { patientAppointments, notesForPatient } from "@/server/db/queries/appointments";
import { writeAudit } from "@/server/db/queries/audit";
import { attendanceByPatient, owedByPatient } from "@/server/db/queries/balances";
import { creditBalance, creditEntries } from "@/server/db/queries/billing";
import {
  getPatient,
  isPatientOfStaff,
  listPatients,
  type PatientListFilter,
} from "@/server/db/queries/patients";
import { guardians, patientBackupStaff, patients, staff } from "@/server/db/schema";
import { fromManilaLocal } from "@/lib/dates";

import { NotFoundError, ValidationError } from "./errors";

const startOfToday = () => fromManilaLocal(clinicToday(), "00:00");

/** Patients at a branch. Every role sees them all, therapists included. */
export async function listPatientsFor(db: DbExecutor, actor: Actor, filter: PatientListFilter) {
  assertCan(actor, "patient:read", { branchId: filter.branchId });
  return listPatients(db, filter);
}

/**
 * The patients list page: one page of rows plus attendance and, for staff who
 * handle money, what each patient owes. Therapists never get balances.
 */
export async function patientListPage(
  db: DbExecutor,
  actor: Actor,
  filter: Omit<PatientListFilter, "sort"> & { sort: "name" | "age" | "attendance" | "balance" },
) {
  const sqlSort = filter.sort === "age" ? "age" : "name";
  // Attendance and balance are computed, so those sorts load the whole (small) branch list.
  const computedSort = filter.sort === "attendance" || filter.sort === "balance";
  const result = await listPatientsFor(db, actor, {
    ...filter,
    sort: sqlSort,
    ...(computedSort ? { page: 0, pageSize: 10_000 } : {}),
  });
  const ids = result.rows.map((p) => p.id);
  const before = startOfToday();
  const [attendance, owed] = await Promise.all([
    attendanceByPatient(db, ids, before),
    actor.role === "therapist"
      ? Promise.resolve(new Map<string, number>())
      : owedByPatient(db, ids, before),
  ]);
  let rows = result.rows.map((p) => ({
    ...p,
    age: p.dateOfBirth ? ageOn(p.dateOfBirth, clinicToday()) : null,
    attendancePct: attendance.get(p.id) ?? null,
    owedCentavos: owed.get(p.id) ?? 0,
  }));
  let { total, page } = result;
  const pageSize = filter.pageSize ?? 9;
  if (computedSort) {
    rows.sort((a, b) =>
      filter.sort === "balance"
        ? b.owedCentavos - a.owedCentavos
        : (b.attendancePct ?? -1) - (a.attendancePct ?? -1),
    );
    total = rows.length;
    page = Math.min(filter.page ?? 0, Math.max(0, Math.ceil(total / pageSize) - 1));
    rows = rows.slice(page * pageSize, page * pageSize + pageSize);
  }
  return { rows, total, page, pageSize };
}

/**
 * Whether the actor may see this patient's clinical record: anyone at the
 * patient's branch, so therapists can read each other's notes.
 */
export function patientIsVisibleTo(actor: Actor, patient: { branchId: string }) {
  return actor.branchIds.includes(patient.branchId);
}

/** Whether a therapist treats this patient, as primary or backup. The desk treats no one. */
async function treatsPatient(db: DbExecutor, actor: Actor, patientId: string) {
  return Boolean(actor.staffId && (await isPatientOfStaff(db, patientId, actor.staffId)));
}

/** One patient's record. */
export async function getPatientRecord(db: DbExecutor, actor: Actor, patientId: string) {
  const record = await getPatient(db, patientId);
  if (!record) throw new NotFoundError();
  if (!patientIsVisibleTo(actor, record.patient)) throw new ForbiddenError();
  assertCan(actor, "patient:read", { branchId: record.patient.branchId });
  return record;
}

/**
 * Everything the patient detail panel shows. Credit is only loaded for roles
 * that may see it; therapists get null.
 */
export async function getPatientDetail(db: DbExecutor, actor: Actor, patientId: string) {
  const record = await getPatientRecord(db, actor, patientId);
  const now = clinicNow();
  const staffIds = [record.patient.primaryStaffId, ...record.backupStaffIds].filter(
    Boolean,
  ) as string[];
  const [staffRows, history, notes, credit, treats] = await Promise.all([
    staffIds.length
      ? db.select().from(staff).where(inArray(staff.id, staffIds))
      : Promise.resolve([]),
    patientAppointments(db, patientId, now),
    notesForPatient(db, patientId),
    actor.role === "therapist"
      ? Promise.resolve(null)
      : Promise.all([creditBalance(db, patientId), creditEntries(db, patientId)]).then(
          ([balance, entries]) => ({ balance, entries }),
        ),
    actor.role === "therapist" ? treatsPatient(db, actor, patientId) : Promise.resolve(false),
  ]);
  const nameOf = (id: string | null) => staffRows.find((s) => s.id === id)?.shortName ?? null;
  return {
    ...record,
    age: record.patient.dateOfBirth ? ageOn(record.patient.dateOfBirth, clinicToday()) : null,
    primaryStaffName: nameOf(record.patient.primaryStaffId),
    backupStaffNames: record.backupStaffIds.map(nameOf).filter((n): n is string => Boolean(n)),
    history,
    notes,
    credit,
    /** A therapist may edit the details of patients they treat; the desk edits anyone. */
    canEditDetails: can(actor, "patient:edit", {
      branchId: record.patient.branchId,
      ownedByActor: actor.role !== "therapist" || treats,
    }),
  };
}

/**
 * Typeahead for the booking dialog and the command palette: every patient at
 * the branch, active ones only when booking.
 */
export async function searchPatients(
  db: DbExecutor,
  actor: Actor,
  input: {
    branchId: string;
    query: string;
    bookableOnly: boolean;
    forBooking?: boolean;
    limit?: number;
  },
) {
  assertCan(actor, "patient:read", { branchId: input.branchId });
  if (input.forBooking) assertCan(actor, "appointment:book", { branchId: input.branchId });
  const term = input.query.trim();
  const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  return db
    .select({
      id: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      service: patients.service,
      status: patients.status,
      guardianName: guardians.name,
      guardianRelationship: guardians.relationship,
    })
    .from(patients)
    .leftJoin(guardians, and(eq(guardians.patientId, patients.id), eq(guardians.isPrimary, true)))
    .where(
      and(
        eq(patients.branchId, input.branchId),
        isNull(patients.deletedAt),
        input.bookableOnly || input.forBooking ? eq(patients.status, "active") : undefined,
        term
          ? or(
              ilike(sql`${patients.firstName} || ' ' || ${patients.lastName}`, like),
              ilike(guardians.name, like),
            )
          : undefined,
      ),
    )
    .orderBy(asc(patients.firstName), asc(patients.lastName))
    .limit(input.limit ?? 20);
}

async function assertStaffAtBranch(db: DbExecutor, branchId: string, staffIds: string[]) {
  if (!staffIds.length) return;
  const found = await db
    .select({ id: staff.id })
    .from(staff)
    .where(and(inArray(staff.id, staffIds), eq(staff.branchId, branchId), isNull(staff.deletedAt)));
  if (found.length !== new Set(staffIds).size)
    throw new ValidationError("Pick therapists from this branch.");
}

function patientColumns(values: ReturnType<typeof patientFormSchema.parse>) {
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    dateOfBirth: values.dateOfBirth || null,
    gender: values.gender,
    diagnosis: values.diagnosis,
    service: values.service,
    enrolledOn: values.enrolledOn,
    primaryStaffId: values.primaryStaffId || null,
    goalsNotes: values.goalsNotes,
  };
}

async function saveGuardianAndBackups(
  db: DbExecutor,
  patientId: string,
  values: ReturnType<typeof patientFormSchema.parse>,
) {
  await db.delete(patientBackupStaff).where(eq(patientBackupStaff.patientId, patientId));
  if (values.backupStaffIds.length) {
    await db
      .insert(patientBackupStaff)
      .values(values.backupStaffIds.map((staffId) => ({ patientId, staffId })));
  }
  const [primary] = await db
    .select()
    .from(guardians)
    .where(and(eq(guardians.patientId, patientId), eq(guardians.isPrimary, true)));
  const guardian = {
    name: values.guardianName,
    relationship: values.guardianRelationship,
    phone: values.guardianPhone,
    email: values.guardianEmail,
  };
  if (primary) await db.update(guardians).set(guardian).where(eq(guardians.id, primary.id));
  else if (values.guardianName)
    await db.insert(guardians).values({ patientId, isPrimary: true, ...guardian });
}

export async function createPatient(
  db: DbExecutor,
  actor: Actor,
  input: { branchId: string; values: unknown },
) {
  assertCan(actor, "patient:create", { branchId: input.branchId });
  const values = patientFormSchema.parse(input.values);
  if (actor.role === "therapist") {
    // A therapist's new patient is theirs: primary therapist, no backups.
    if (!actor.staffId) throw new ForbiddenError();
    values.primaryStaffId = actor.staffId;
    values.backupStaffIds = [];
  }
  await assertStaffAtBranch(
    db,
    input.branchId,
    [values.primaryStaffId, ...values.backupStaffIds].filter(Boolean),
  );
  const [created] = await db
    .insert(patients)
    .values({ branchId: input.branchId, ...patientColumns(values) })
    .returning();
  await saveGuardianAndBackups(db, created!.id, values);
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "patient.create",
    entity: "patient",
    entityId: created!.id,
    after: values,
    ip: actor.ip,
  });
  return created!;
}

export async function updatePatient(
  db: DbExecutor,
  actor: Actor,
  input: { patientId: string; values: unknown },
) {
  const existing = await getPatient(db, input.patientId);
  if (!existing) throw new NotFoundError();
  const values = patientFormSchema.parse(input.values);
  if (actor.role === "therapist") {
    // Patients they treat only, and who treats the patient stays as the desk set it.
    assertCan(actor, "patient:edit", {
      branchId: existing.patient.branchId,
      ownedByActor: await treatsPatient(db, actor, input.patientId),
    });
    values.primaryStaffId = existing.patient.primaryStaffId ?? "";
    values.backupStaffIds = existing.backupStaffIds;
  } else {
    assertCan(actor, "patient:edit", { branchId: existing.patient.branchId });
  }
  await assertStaffAtBranch(
    db,
    existing.patient.branchId,
    [values.primaryStaffId, ...values.backupStaffIds].filter(Boolean),
  );
  const [updated] = await db
    .update(patients)
    .set(patientColumns(values))
    .where(eq(patients.id, input.patientId))
    .returning();
  await saveGuardianAndBackups(db, input.patientId, values);
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "patient.update",
    entity: "patient",
    entityId: input.patientId,
    before: {
      ...existing.patient,
      guardians: existing.guardians,
      backupStaffIds: existing.backupStaffIds,
    },
    after: values,
    ip: actor.ip,
  });
  return updated!;
}

/** Inactive patients cannot be booked and leave booking search, but stay in reports. */
export async function setPatientStatus(
  db: DbExecutor,
  actor: Actor,
  input: { patientId: string; status: "active" | "inactive" },
) {
  const existing = await getPatient(db, input.patientId);
  if (!existing) throw new NotFoundError();
  assertCan(actor, "patient:write", { branchId: existing.patient.branchId });
  await db.update(patients).set({ status: input.status }).where(eq(patients.id, input.patientId));
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "patient.status",
    entity: "patient",
    entityId: input.patientId,
    before: { status: existing.patient.status },
    after: { status: input.status },
    ip: actor.ip,
  });
}

/** Soft delete: the patient disappears from lists; sessions, notes and payments stay. */
export async function deletePatient(db: DbExecutor, actor: Actor, input: { patientId: string }) {
  const existing = await getPatient(db, input.patientId);
  if (!existing) throw new NotFoundError();
  assertCan(actor, "patient:write", { branchId: existing.patient.branchId });
  const deletedAt = clinicNow();
  await db.update(patients).set({ deletedAt }).where(eq(patients.id, input.patientId));
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "patient.delete",
    entity: "patient",
    entityId: input.patientId,
    after: { deletedAt },
    ip: actor.ip,
  });
}
