import "server-only";

import type { Actor } from "@/server/auth/actor";
import { assertCan, ForbiddenError } from "@/server/auth/permissions";
import type { DbExecutor } from "@/server/db/client";
import {
  getPatient,
  isPatientOfStaff,
  listPatients,
  type PatientListFilter,
} from "@/server/db/queries/patients";

import { NotFoundError } from "./errors";

/** Patients the actor may see at a branch. Therapists only get their own. */
export async function listPatientsFor(db: DbExecutor, actor: Actor, filter: PatientListFilter) {
  assertCan(actor, "patient:read", { branchId: filter.branchId });
  return listPatients(db, {
    ...filter,
    onlyStaffId: actor.role === "therapist" ? (actor.staffId ?? "none") : null,
  });
}

/** Whether the actor may see this patient's clinical record. */
export async function patientIsVisibleTo(
  db: DbExecutor,
  actor: Actor,
  patient: { id: string; branchId: string },
) {
  if (!actor.branchIds.includes(patient.branchId)) return false;
  if (actor.role !== "therapist") return true;
  return Boolean(actor.staffId && (await isPatientOfStaff(db, patient.id, actor.staffId)));
}

/**
 * One patient's record. A therapist asking for someone else's patient gets the
 * same "not found" as a missing record, so ids cannot be probed.
 */
export async function getPatientRecord(db: DbExecutor, actor: Actor, patientId: string) {
  const record = await getPatient(db, patientId);
  if (!record) throw new NotFoundError();
  const visible = await patientIsVisibleTo(db, actor, record.patient);
  if (!visible)
    throw actor.branchIds.includes(record.patient.branchId)
      ? new NotFoundError()
      : new ForbiddenError();
  assertCan(actor, "patient:read", { branchId: record.patient.branchId, ownedByActor: true });
  return record;
}
