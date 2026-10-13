import "server-only";

import {
  and,
  arrayContains,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  isNull,
  or,
  type SQL,
  sql,
} from "drizzle-orm";

import type { DbExecutor } from "../client";
import { guardians, patientBackupStaff, patients } from "../schema";

export type PatientRow = typeof patients.$inferSelect;
export type GuardianRow = typeof guardians.$inferSelect;

export type PatientListFilter = {
  branchId: string;
  query?: string;
  service?: "ot" | "speech" | "sped";
  status?: "active" | "inactive";
  sort?: "name" | "age" | "recent";
  page?: number;
  pageSize?: number;
};

/** Escapes LIKE wildcards so a search for "50%" is literal. */
const likeTerm = (term: string) => `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

function filterWhere(filter: PatientListFilter): SQL {
  const conditions: (SQL | undefined)[] = [
    eq(patients.branchId, filter.branchId),
    isNull(patients.deletedAt),
  ];
  if (filter.service) conditions.push(arrayContains(patients.services, [filter.service]));
  if (filter.status) conditions.push(eq(patients.status, filter.status));
  const term = filter.query?.trim();
  if (term) {
    const like = likeTerm(term);
    conditions.push(
      or(
        ilike(sql`${patients.firstName} || ' ' || ${patients.lastName}`, like),
        exists(
          sql`(select 1 from ${guardians} where ${guardians.patientId} = ${patients.id} and ${guardians.name} ilike ${like})`,
        ),
      ),
    );
  }
  return and(...conditions)!;
}

/** Server-side search, filter, sort and pagination. */
export async function listPatients(db: DbExecutor, filter: PatientListFilter) {
  const pageSize = filter.pageSize ?? 9;
  const page = Math.max(0, filter.page ?? 0);
  const where = filterWhere(filter);
  const order =
    filter.sort === "age"
      ? [desc(patients.dateOfBirth), asc(patients.lastName)]
      : filter.sort === "recent"
        ? [desc(patients.createdAt)]
        : [asc(patients.firstName), asc(patients.lastName)];

  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(patients)
      .where(where)
      .orderBy(...order)
      .limit(pageSize)
      .offset(page * pageSize),
    db.select({ value: count() }).from(patients).where(where),
  ]);
  return { rows, total: total?.value ?? 0, page, pageSize };
}

export async function getPatient(db: DbExecutor, id: string) {
  const [patient] = await db
    .select()
    .from(patients)
    .where(and(eq(patients.id, id), isNull(patients.deletedAt)));
  if (!patient) return null;
  const [guardianRows, backups] = await Promise.all([
    db
      .select()
      .from(guardians)
      .where(eq(guardians.patientId, id))
      .orderBy(desc(guardians.isPrimary)),
    db
      .select({ staffId: patientBackupStaff.staffId })
      .from(patientBackupStaff)
      .where(eq(patientBackupStaff.patientId, id)),
  ]);
  return { patient, guardians: guardianRows, backupStaffIds: backups.map((b) => b.staffId) };
}

/** Whether a staff member is the patient's primary or backup therapist. */
export async function isPatientOfStaff(db: DbExecutor, patientId: string, staffId: string) {
  const [row] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(
      and(
        eq(patients.id, patientId),
        or(
          eq(patients.primaryStaffId, staffId),
          exists(
            sql`(select 1 from ${patientBackupStaff} where ${patientBackupStaff.patientId} = ${patients.id} and ${patientBackupStaff.staffId} = ${staffId})`,
          ),
        ),
      ),
    );
  return Boolean(row);
}
