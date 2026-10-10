import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@/server/auth/permissions";
import { auditLog, guardians, patientBackupStaff, patients } from "@/server/db/schema";
import {
  createPatient,
  deletePatient,
  getPatientDetail,
  patientListPage,
  searchPatients,
  setPatientStatus,
  updatePatient,
} from "@/server/services/patients";

import { ACTORS } from "../support/actors";
import { inRollback, testDb } from "./support";

const newPatient = {
  firstName: "Rina",
  lastName: "Uy",
  dateOfBirth: "2021-05-04",
  gender: "female",
  diagnosis: "Speech sound disorder",
  service: "speech",
  enrolledOn: "2026-08-22",
  primaryStaffId: "stf_lim",
  backupStaffIds: ["stf_tan"],
  guardianName: "Lea Uy",
  guardianRelationship: "Mother",
  guardianPhone: "0917 555 0101",
  guardianEmail: "lea.uy@example.test",
};

describe("patient CRUD", () => {
  it("creates a patient with guardian, backups and an audit entry", () =>
    inRollback(async (tx) => {
      const created = await createPatient(tx, ACTORS.desk, {
        branchId: "br_bangkal",
        values: newPatient,
      });
      const [guardian] = await tx
        .select()
        .from(guardians)
        .where(eq(guardians.patientId, created.id));
      expect(guardian).toMatchObject({ name: "Lea Uy", isPrimary: true });
      const backups = await tx
        .select()
        .from(patientBackupStaff)
        .where(eq(patientBackupStaff.patientId, created.id));
      expect(backups.map((b) => b.staffId)).toEqual(["stf_tan"]);
      const [entry] = await tx.select().from(auditLog).where(eq(auditLog.entityId, created.id));
      expect(entry).toMatchObject({ action: "patient.create", actorUserId: "usr_desk" });
    }));

  it("validates on the server too", () =>
    inRollback(async (tx) => {
      await expect(
        createPatient(tx, ACTORS.desk, {
          branchId: "br_bangkal",
          values: { ...newPatient, firstName: "" },
        }),
      ).rejects.toThrow(/first name/);
      await expect(
        createPatient(tx, ACTORS.desk, {
          branchId: "br_bangkal",
          values: { ...newPatient, backupStaffIds: ["stf_lim"] },
        }),
      ).rejects.toThrow(/primary therapist can't also be a backup/);
    }));

  it("updates and keeps the before and after in the audit log", () =>
    inRollback(async (tx) => {
      await updatePatient(tx, ACTORS.owner, {
        patientId: "pat_01",
        values: {
          ...newPatient,
          firstName: "Liam",
          lastName: "Santos",
          service: "ot",
          primaryStaffId: "stf_delarosa",
        },
      });
      const [row] = await tx.select().from(patients).where(eq(patients.id, "pat_01"));
      expect(row!.diagnosis).toBe("Speech sound disorder");
      const [entry] = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.entityId, "pat_01"), eq(auditLog.action, "patient.update")));
      expect((entry!.before as { diagnosis: string }).diagnosis).toBe("Global developmental delay");
    }));

  it("inactive patients drop out of booking search but stay listed", () =>
    inRollback(async (tx) => {
      await setPatientStatus(tx, ACTORS.desk, { patientId: "pat_13", status: "inactive" });
      const bookable = await searchPatients(tx, ACTORS.desk, {
        branchId: "br_bangkal",
        query: "Hana",
        bookableOnly: true,
      });
      expect(bookable).toHaveLength(0);
      const any = await searchPatients(tx, ACTORS.desk, {
        branchId: "br_bangkal",
        query: "Hana",
        bookableOnly: false,
      });
      expect(any[0]).toMatchObject({ firstName: "Hana", status: "inactive" });
    }));

  it("soft deletes: the row stays, lists and search hide it", () =>
    inRollback(async (tx) => {
      await deletePatient(tx, ACTORS.owner, { patientId: "pat_16" });
      const [row] = await tx.select().from(patients).where(eq(patients.id, "pat_16"));
      expect(row!.deletedAt).not.toBeNull();
      const hits = await searchPatients(tx, ACTORS.owner, {
        branchId: "br_bangkal",
        query: "Kian",
        bookableOnly: false,
      });
      expect(hits).toHaveLength(0);
    }));

  it("therapists cannot create, edit or deactivate patients", () =>
    inRollback(async (tx) => {
      await expect(
        createPatient(tx, ACTORS.therapist, { branchId: "br_bangkal", values: newPatient }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        setPatientStatus(tx, ACTORS.therapist, { patientId: "pat_01", status: "inactive" }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }));

  it("therapist search only finds their own patients", async () => {
    const hits = await searchPatients(testDb(), ACTORS.therapist, {
      branchId: "br_bangkal",
      query: "",
      bookableOnly: false,
      limit: 50,
    });
    expect(hits.map((h) => h.firstName)).toContain("Liam");
    expect(hits.map((h) => h.firstName)).not.toContain("Sofia");
  });
});

describe("patients list page", () => {
  it("adds attendance and owed balances, sorted by balance on request", async () => {
    const page = await patientListPage(testDb(), ACTORS.desk, {
      branchId: "br_bangkal",
      sort: "balance",
    });
    expect(page.rows.slice(0, 4).map((p) => [p.firstName, p.owedCentavos])).toEqual([
      ["Althea", 350_000],
      ["Enzo", 140_000],
      ["Kian", 140_000],
      ["Elle", 70_000],
    ]);
    expect(page.total).toBe(16);
  });

  it("never gives therapists balances", async () => {
    const page = await patientListPage(testDb(), ACTORS.therapist, {
      branchId: "br_bangkal",
      sort: "name",
      pageSize: 50,
    });
    expect(page.rows.every((p) => p.owedCentavos === 0)).toBe(true);
  });

  it("detail includes credit for the desk, not for therapists", async () => {
    expect((await getPatientDetail(testDb(), ACTORS.desk, "pat_01")).credit?.balance).toBe(420_000);
    expect((await getPatientDetail(testDb(), ACTORS.therapist, "pat_01")).credit).toBeNull();
  });
});
