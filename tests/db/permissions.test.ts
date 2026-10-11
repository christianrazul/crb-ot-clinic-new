import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@/server/auth/permissions";
import { auditLog, appointments } from "@/server/db/schema";
import { setAppointmentStatus } from "@/server/services/appointments";
import { getCreditLedger, listBillingDay } from "@/server/services/billing";
import { NotFoundError } from "@/server/services/errors";
import { getPatientRecord, listPatientsFor } from "@/server/services/patients";
import { createAccount } from "@/server/services/users";

import { ACTORS } from "../support/actors";
import { inRollback, testDb } from "./support";

// These call the same service functions the Server Actions call, with the
// actor the server would build from the session. Nothing from the client can
// widen what a role sees.
describe("a therapist", () => {
  const me = ACTORS.therapist;

  it("cannot read another therapist's patient", async () => {
    // Sofia Reyes is Anna Garcia's SPED patient.
    await expect(getPatientRecord(testDb(), me, "pat_04")).rejects.toBeInstanceOf(NotFoundError);
    await expect(getPatientRecord(testDb(), me, "pat_01")).resolves.toMatchObject({
      patient: { firstName: "Liam" },
    });
  });

  it("only lists their own patients, whatever filter they send", async () => {
    const { rows } = await listPatientsFor(testDb(), me, { branchId: "br_bangkal", pageSize: 50 });
    expect(rows.map((p) => p.firstName)).not.toContain("Sofia");
    const search = await listPatientsFor(testDb(), me, { branchId: "br_bangkal", query: "Sofia" });
    expect(search.total).toBe(0);
  });

  it("cannot read billing or credit", async () => {
    await expect(
      listBillingDay(testDb(), me, { branchId: "br_bangkal", date: "2026-08-22" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(getCreditLedger(testDb(), me, "pat_01")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("cannot change an appointment's status, even their own", () =>
    inRollback(async (tx) => {
      await expect(
        setAppointmentStatus(tx, me, {
          appointmentId: "apt_20260822_11_delarosa",
          status: "attended",
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      const [row] = await tx
        .select()
        .from(appointments)
        .where(eq(appointments.id, "apt_20260822_11_delarosa"));
      expect(row!.status).toBe("scheduled");
    }));

  it("cannot create accounts", () =>
    inRollback(async (tx) => {
      await expect(
        createAccount(tx, me, {
          name: "Eve",
          email: "eve@example.test",
          role: "superadmin",
          branchIds: ["br_bangkal"],
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }));
});

describe("the front desk", () => {
  it("reads billing and credit at their branch only", async () => {
    const rows = await listBillingDay(testDb(), ACTORS.desk, {
      branchId: "br_bangkal",
      date: "2026-08-22",
    });
    expect(rows.length).toBe(5);
    await expect(getCreditLedger(testDb(), ACTORS.desk, "pat_01")).resolves.toMatchObject({
      balance: 420_000,
    });
    await expect(
      listBillingDay(testDb(), ACTORS.desk, { branchId: "br_panabo", date: "2026-08-22" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("changes status, snapshots payroll on attended and writes the audit log", () =>
    inRollback(async (tx) => {
      const after = await setAppointmentStatus(tx, ACTORS.desk, {
        appointmentId: "apt_20260822_11_delarosa",
        status: "attended",
      });
      expect(after).toMatchObject({
        status: "attended",
        payrollRateCentavos: 70_000,
        payrollSharePct: 70,
        statusChangedByUserId: "usr_desk",
      });
      const [entry] = await tx
        .select()
        .from(auditLog)
        .where(eq(auditLog.entityId, "apt_20260822_11_delarosa"));
      expect(entry).toMatchObject({
        action: "appointment.status",
        actorUserId: "usr_desk",
        after: { status: "attended" },
      });
    }));

  it("cannot create accounts; the owner can", () =>
    inRollback(async (tx) => {
      const input = {
        name: "Rita Cruz",
        email: "rita@example.test",
        role: "secretary",
        branchIds: ["br_bangkal"],
      };
      await expect(createAccount(tx, ACTORS.desk, input)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(createAccount(tx, ACTORS.owner, input)).resolves.toMatchObject({
        email: "rita@example.test",
      });
    }));
});
