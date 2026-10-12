import "server-only";

import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import type { Actor } from "@/server/auth/actor";
import { assertCan } from "@/server/auth/permissions";
import { clinicNow } from "@/server/clock";
import type { DbExecutor } from "@/server/db/client";
import { writeAudit } from "@/server/db/queries/audit";
import {
  appointments,
  auditLog,
  creditLedger,
  guardians,
  patients,
  payments,
  sessionNotes,
  sessionTypes,
  staff,
} from "@/server/db/schema";

import { NotFoundError, ValidationError } from "./errors";

async function patientRow(db: DbExecutor, patientId: string) {
  const [patient] = await db.select().from(patients).where(eq(patients.id, patientId));
  if (!patient) throw new NotFoundError();
  return patient;
}

/**
 * Everything the clinic holds about one patient, for a data subject access
 * request under the Data Privacy Act. Owner only, and the export is audited.
 */
export async function exportPatientData(db: DbExecutor, actor: Actor, patientId: string) {
  const patient = await patientRow(db, patientId);
  assertCan(actor, "patient:export", { branchId: patient.branchId });

  const [guardianRows, sessionRows, noteRows, paymentRows, ledgerRows] = await Promise.all([
    db.select().from(guardians).where(eq(guardians.patientId, patientId)),
    db
      .select({
        id: appointments.id,
        startsAt: appointments.startsAt,
        endsAt: appointments.endsAt,
        status: appointments.status,
        sessionType: sessionTypes.name,
        staff: staff.displayName,
        feeCentavos: appointments.feeCentavos,
        isMakeUp: appointments.isMakeUp,
      })
      .from(appointments)
      .innerJoin(sessionTypes, eq(appointments.sessionTypeId, sessionTypes.id))
      .innerJoin(staff, eq(appointments.staffId, staff.id))
      .where(eq(appointments.patientId, patientId))
      .orderBy(asc(appointments.startsAt)),
    db
      .select({
        id: sessionNotes.id,
        appointmentId: sessionNotes.appointmentId,
        author: staff.displayName,
        body: sessionNotes.body,
        version: sessionNotes.version,
        supersedesId: sessionNotes.supersedesId,
        createdAt: sessionNotes.createdAt,
      })
      .from(sessionNotes)
      .innerJoin(staff, eq(sessionNotes.authorStaffId, staff.id))
      .where(eq(sessionNotes.patientId, patientId))
      .orderBy(asc(sessionNotes.createdAt)),
    db
      .select({
        receiptNo: payments.receiptNo,
        appointmentId: payments.appointmentId,
        amountCentavos: payments.amountCentavos,
        creditAppliedCentavos: payments.creditAppliedCentavos,
        method: payments.method,
        referenceNo: payments.referenceNo,
        createdAt: payments.createdAt,
        voidedAt: payments.voidedAt,
        voidReason: payments.voidReason,
      })
      .from(payments)
      .where(eq(payments.patientId, patientId))
      .orderBy(asc(payments.createdAt)),
    db
      .select({
        type: creditLedger.type,
        amountCentavos: creditLedger.amountCentavos,
        description: creditLedger.description,
        method: creditLedger.method,
        referenceNo: creditLedger.referenceNo,
        receiptNo: creditLedger.receiptNo,
        createdAt: creditLedger.createdAt,
        voidedAt: creditLedger.voidedAt,
        voidReason: creditLedger.voidReason,
      })
      .from(creditLedger)
      .where(eq(creditLedger.patientId, patientId))
      .orderBy(asc(creditLedger.createdAt)),
  ]);

  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "patient.export",
    entity: "patient",
    entityId: patientId,
    ip: actor.ip,
  });

  return {
    exportedAt: clinicNow().toISOString(),
    note: "Amounts are in centavos (100 centavos = 1 peso). Times are UTC.",
    patient: {
      id: patient.id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
      diagnosis: patient.diagnosis,
      enrolledOn: patient.enrolledOn,
      service: patient.service,
      status: patient.status,
      goalsNotes: patient.goalsNotes,
      removedAt: patient.deletedAt,
      anonymizedAt: patient.anonymizedAt,
    },
    guardians: guardianRows.map((g) => ({
      name: g.name,
      relationship: g.relationship,
      phone: g.phone,
      email: g.email,
      isPrimary: g.isPrimary,
    })),
    sessions: sessionRows,
    sessionNotes: noteRows,
    payments: paymentRows,
    creditLedger: ledgerRows,
  };
}

const anonymizeInput = z.object({
  patientId: z.string().min(1).max(64),
  /** The patient's full name, typed to confirm. */
  confirmName: z.string().trim().max(200),
});

const REDACTED = { redacted: true };

/**
 * Erases a patient's identifying details for good while keeping the clinical
 * and financial history (sessions, notes, payments, credit), which the clinic
 * must retain. Removes name, birth date, diagnosis, goals and guardian
 * contacts, and redacts the patient's old audit entries. Cannot be undone.
 */
export async function anonymizePatient(db: DbExecutor, actor: Actor, raw: unknown) {
  const input = anonymizeInput.parse(raw);
  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, input.patientId))
    .for("update");
  if (!patient) throw new NotFoundError();
  assertCan(actor, "patient:anonymize", { branchId: patient.branchId });
  if (patient.anonymizedAt) throw new ValidationError("This patient was already anonymized.");
  const fullName = `${patient.firstName} ${patient.lastName}`;
  if (input.confirmName.toLowerCase() !== fullName.toLowerCase()) {
    throw new ValidationError(`Type "${fullName}" exactly to confirm.`);
  }
  const [booked] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.patientId, patient.id),
        inArray(appointments.status, ["scheduled", "checked_in"]),
        gt(appointments.startsAt, clinicNow()),
      ),
    )
    .limit(1);
  if (booked) throw new ValidationError("Cancel this patient's upcoming sessions first.");

  const now = clinicNow();
  await db
    .update(patients)
    .set({
      firstName: "Anonymized",
      lastName: `patient ${patient.id.slice(-6)}`,
      dateOfBirth: null,
      gender: "unspecified",
      diagnosis: "",
      goalsNotes: "",
      recurringSlot: "Unscheduled",
      status: "inactive",
      deletedAt: patient.deletedAt ?? now,
      anonymizedAt: now,
      updatedAt: now,
    })
    .where(eq(patients.id, patient.id));
  await db
    .update(guardians)
    .set({ name: "Removed", relationship: "", phone: "", email: "", updatedAt: now })
    .where(eq(guardians.patientId, patient.id));

  // Old entries for this patient and their guardians may hold the details just erased.
  const guardianIds = (
    await db.select({ id: guardians.id }).from(guardians).where(eq(guardians.patientId, patient.id))
  ).map((g) => g.id);
  await db.execute(sql`set local crb.audit_redaction = 'on'`);
  await db
    .update(auditLog)
    .set({
      before: sql`case when ${auditLog.before} is null then null else ${JSON.stringify(REDACTED)}::jsonb end`,
      after: sql`case when ${auditLog.after} is null then null else ${JSON.stringify(REDACTED)}::jsonb end`,
    })
    .where(
      and(
        inArray(auditLog.entity, ["patient", "guardian"]),
        inArray(auditLog.entityId, [patient.id, ...guardianIds]),
      ),
    );
  await db.execute(sql`set local crb.audit_redaction = 'off'`);

  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "patient.anonymize",
    entity: "patient",
    entityId: patient.id,
    after: { anonymizedAt: now },
    ip: actor.ip,
  });
}
