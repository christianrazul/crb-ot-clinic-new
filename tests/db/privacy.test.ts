import { and, eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@/server/auth/permissions";
import { auditLog, guardians, patients, sessionNotes } from "@/server/db/schema";
import { auditEntities, listAuditLog } from "@/server/services/audit";
import { anonymizePatient, exportPatientData } from "@/server/services/patient-privacy";
import { setPatientStatus, updatePatient } from "@/server/services/patients";

import { ACTORS } from "../support/actors";
import { failureCode, inRollback, PG } from "./support";

describe("patient data export", () => {
  it("includes the record, sessions, notes and money, and is audited", () =>
    inRollback(async (tx) => {
      const data = await exportPatientData(tx, ACTORS.owner, "pat_01");
      expect(data.patient).toMatchObject({ id: "pat_01", firstName: "Liam", lastName: "Santos" });
      expect(data.guardians.length).toBeGreaterThan(0);
      expect(data.sessions.length).toBeGreaterThan(0);
      expect(data.sessionNotes.length).toBeGreaterThan(0);
      expect(data.creditLedger.length).toBeGreaterThan(0);
      const [entry] = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.action, "patient.export"), eq(auditLog.entityId, "pat_01")));
      expect(entry).toMatchObject({ actorUserId: "usr_owner" });
    }));

  it("is for the owner only", () =>
    inRollback(async (tx) => {
      await expect(exportPatientData(tx, ACTORS.desk, "pat_01")).rejects.toBeInstanceOf(
        ForbiddenError,
      );
      await expect(exportPatientData(tx, ACTORS.therapist, "pat_01")).rejects.toBeInstanceOf(
        ForbiddenError,
      );
    }));
});

describe("anonymizing a patient", () => {
  it("erases identifiers, keeps history and redacts old audit entries", () =>
    inRollback(async (tx) => {
      // An earlier edit leaves the name in the audit log.
      await updatePatient(tx, ACTORS.desk, {
        patientId: "pat_15",
        values: { ...(await editableValues(tx, "pat_15")), diagnosis: "Sensory processing" },
      });
      await anonymizePatient(tx, ACTORS.owner, { patientId: "pat_15", confirmName: "jaz ocampo" });

      const [row] = await tx.select().from(patients).where(eq(patients.id, "pat_15"));
      expect(row).toMatchObject({
        firstName: "Anonymized",
        dateOfBirth: null,
        diagnosis: "",
        status: "inactive",
      });
      expect(row!.anonymizedAt).not.toBeNull();
      expect(row!.deletedAt).not.toBeNull();
      const guardianRows = await tx
        .select()
        .from(guardians)
        .where(eq(guardians.patientId, "pat_15"));
      expect(guardianRows.every((g) => g.name === "Removed" && g.phone === "")).toBe(true);

      const entries = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.entity, "patient"), eq(auditLog.entityId, "pat_15")));
      const dump = JSON.stringify(entries);
      expect(dump).not.toContain("Ocampo");
      expect(entries.find((e) => e.action === "patient.update")).toMatchObject({
        before: { redacted: true },
        after: { redacted: true },
      });
      expect(entries.some((e) => e.action === "patient.anonymize")).toBe(true);
    }));

  it("needs the exact name, no upcoming sessions, and the owner", () =>
    inRollback(async (tx) => {
      await expect(
        anonymizePatient(tx, ACTORS.owner, { patientId: "pat_15", confirmName: "Jaz" }),
      ).rejects.toThrow(/exactly to confirm/);
      await expect(
        anonymizePatient(tx, ACTORS.owner, { patientId: "pat_01", confirmName: "Liam Santos" }),
      ).rejects.toThrow(/upcoming sessions/);
      await expect(
        anonymizePatient(tx, ACTORS.desk, { patientId: "pat_15", confirmName: "Jaz Ocampo" }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }));

  it("keeps the audit log append-only outside redaction", () =>
    inRollback(async (tx) => {
      await anonymizePatient(tx, ACTORS.owner, { patientId: "pat_15", confirmName: "Jaz Ocampo" });
      // The redaction switch is off again after anonymizing.
      expect(
        await failureCode(tx, (t) =>
          t.execute(
            sql`update audit_log set action = 'x' where id = (select min(id) from audit_log)`,
          ),
        ),
      ).toBe(PG.restrictViolation);
      // Even with the switch on, only a redaction is allowed, and never a delete.
      expect(
        await failureCode(tx, async (t) => {
          await t.execute(sql`set local crb.audit_redaction = 'on'`);
          await t.execute(
            sql`update audit_log set action = 'x' where id = (select min(id) from audit_log)`,
          );
        }),
      ).toBe(PG.restrictViolation);
      expect(
        await failureCode(tx, async (t) => {
          await t.execute(sql`set local crb.audit_redaction = 'on'`);
          await t.execute(sql`delete from audit_log where id = (select min(id) from audit_log)`);
        }),
      ).toBe(PG.restrictViolation);
      // Notes stay append-only too.
      expect(await failureCode(tx, (t) => t.update(sessionNotes).set({ body: "x" }))).toBe(
        PG.restrictViolation,
      );
    }));
});

describe("audit log viewer", () => {
  it("lists newest first with paging and filters, for the owner only", () =>
    inRollback(async (tx) => {
      for (const status of ["inactive", "active"] as const) {
        await setPatientStatus(tx, ACTORS.desk, { patientId: "pat_13", status });
      }
      const page = await listAuditLog(tx, ACTORS.owner, { entity: "patient" });
      expect(page.rows[0]).toMatchObject({ action: "patient.status", actorName: "Jo Lauron" });
      expect(page.rows[0]!.id).toBeGreaterThan(page.rows[1]!.id);
      expect(await auditEntities(tx, ACTORS.owner)).toContain("patient");
      await expect(listAuditLog(tx, ACTORS.desk, {})).rejects.toBeInstanceOf(ForbiddenError);
    }));
});

/** The patient form values for an existing patient, as the edit dialog would send them. */
async function editableValues(tx: Parameters<typeof updatePatient>[0], patientId: string) {
  const [p] = await tx.select().from(patients).where(eq(patients.id, patientId));
  const [g] = await tx.select().from(guardians).where(eq(guardians.patientId, patientId));
  return {
    firstName: p!.firstName,
    lastName: p!.lastName,
    dateOfBirth: p!.dateOfBirth ?? "",
    gender: p!.gender,
    diagnosis: p!.diagnosis,
    service: p!.service as "ot" | "speech" | "sped",
    enrolledOn: p!.enrolledOn,
    primaryStaffId: p!.primaryStaffId ?? "",
    backupStaffIds: [],
    goalsNotes: p!.goalsNotes,
    guardianName: g?.name ?? "",
    guardianRelationship: g?.relationship ?? "",
    guardianPhone: g?.phone ?? "",
    guardianEmail: g?.email ?? "",
  };
}
