"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { runAction } from "@/server/actions/run-action";
import {
  createPatient,
  deletePatient,
  searchPatients,
  setPatientStatus,
  updatePatient,
} from "@/server/services/patients";
import { currentBranchId } from "@/server/session/shell";

const id = z.string().min(1).max(64);

export async function createPatientAction(values: unknown) {
  const branchId = await currentBranchId();
  const result = await runAction(({ db, actor }) => createPatient(db, actor, { branchId, values }));
  if (result.ok) revalidatePath("/patients");
  return result.ok ? { ok: true as const, data: { id: result.data.id } } : result;
}

export async function updatePatientAction(patientId: unknown, values: unknown) {
  const result = await runAction(({ db, actor }) =>
    updatePatient(db, actor, { patientId: id.parse(patientId), values }),
  );
  if (result.ok) revalidatePath("/patients");
  return result.ok ? { ok: true as const, data: undefined } : result;
}

export async function setPatientStatusAction(patientId: unknown, status: unknown) {
  const result = await runAction(({ db, actor }) =>
    setPatientStatus(db, actor, {
      patientId: id.parse(patientId),
      status: z.enum(["active", "inactive"]).parse(status),
    }),
  );
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function deletePatientAction(patientId: unknown) {
  const result = await runAction(({ db, actor }) =>
    deletePatient(db, actor, { patientId: id.parse(patientId) }),
  );
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

/** Typeahead for the command palette and the booking dialog. */
export async function searchPatientsAction(input: unknown) {
  const parsed = z.object({ query: z.string().max(80), bookableOnly: z.boolean() }).parse(input);
  const branchId = await currentBranchId();
  return runAction(({ db, actor }) => searchPatients(db, actor, { branchId, ...parsed }), {
    transaction: false,
  });
}
