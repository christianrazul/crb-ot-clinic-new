import { describe, expect, it } from "vitest";

import { fromManilaLocal } from "@/lib/dates";
import { listAppointments } from "@/server/db/queries/appointments";
import { branchesForUser, listBranches } from "@/server/db/queries/branches";
import { creditEntries } from "@/server/db/queries/billing";
import { getPatient, isPatientOfStaff, listPatients } from "@/server/db/queries/patients";
import { listSessionTypes } from "@/server/db/queries/session-types";
import { listStaff } from "@/server/db/queries/staff";

import { testDb } from "./support";

describe("branches", () => {
  it("lists branches and a user's branches", async () => {
    expect((await listBranches(testDb())).map((b) => b.name)).toEqual([
      "CRB Bangkal",
      "CRB Panabo",
    ]);
    expect((await branchesForUser(testDb(), "usr_desk")).map((b) => b.id)).toEqual(["br_bangkal"]);
    expect((await branchesForUser(testDb(), "usr_owner")).map((b) => b.id)).toEqual([
      "br_bangkal",
      "br_panabo",
    ]);
  });
});

describe("patients", () => {
  const base = { branchId: "br_bangkal" };

  it("pages, sorts by name and counts", async () => {
    const first = await listPatients(testDb(), base);
    expect(first.total).toBe(16);
    expect(first.rows).toHaveLength(9);
    expect(first.rows[0]!.firstName).toBe("Althea");
    const second = await listPatients(testDb(), { ...base, page: 1 });
    expect(second.rows).toHaveLength(7);
  });

  it("searches names and guardians, case-insensitively", async () => {
    expect(
      (await listPatients(testDb(), { ...base, query: "santos" })).rows.map((p) => p.firstName),
    ).toEqual(["Liam"]);
    // Paolo Mendoza is Althea's father.
    expect(
      (await listPatients(testDb(), { ...base, query: "paolo" })).rows.map((p) => p.firstName),
    ).toEqual(["Althea"]);
    // LIKE wildcards are escaped.
    expect((await listPatients(testDb(), { ...base, query: "%" })).total).toBe(0);
  });

  it("filters by service and status", async () => {
    // Three SPED-main patients plus pat_03, who also gets SPED.
    expect((await listPatients(testDb(), { ...base, service: "sped" })).total).toBe(4);
    expect((await listPatients(testDb(), { ...base, status: "inactive" })).total).toBe(0);
  });

  it("knows whether a therapist treats a patient (primary or backup)", async () => {
    expect(await isPatientOfStaff(testDb(), "pat_04", "stf_delarosa")).toBe(false);
    expect(await isPatientOfStaff(testDb(), "pat_01", "stf_delarosa")).toBe(true);
  });

  it("loads a patient with guardians and backups", async () => {
    const detail = await getPatient(testDb(), "pat_05");
    expect(detail?.patient.diagnosis).toBe("Sensory processing disorder");
    expect(detail?.guardians[0]).toMatchObject({ name: "Paolo Mendoza", isPrimary: true });
    expect(detail?.backupStaffIds).toEqual(["stf_tan"]);
  });
});

describe("scheduling and settings", () => {
  it("lists a day's appointments by branch and staff", async () => {
    const from = fromManilaLocal("2026-08-22", "00:00");
    const to = fromManilaLocal("2026-08-23", "00:00");
    expect(await listAppointments(testDb(), { branchId: "br_bangkal", from, to })).toHaveLength(14);
    expect(
      await listAppointments(testDb(), {
        branchId: "br_bangkal",
        from,
        to,
        staffId: "stf_delarosa",
      }),
    ).toHaveLength(3);
    expect(await listAppointments(testDb(), { branchId: "br_panabo", from, to })).toHaveLength(0);
  });

  it("lists staff with rate classes and session types with allowed classes", async () => {
    expect((await listStaff(testDb(), "br_bangkal")).map((s) => s.rateClass.shortName)).toEqual([
      "OT",
      "OT",
      "OT Aide",
      "Speech",
      "SPED",
    ]);
    const types = await listSessionTypes(testDb(), { branchId: "br_bangkal" });
    expect(types.find((t) => t.id === "st_ot")?.allowedRateClassIds?.sort()).toEqual([
      "rc_ot",
      "rc_ot_aide",
    ]);
    expect(types.find((t) => t.id === "st_makeup")?.allowedRateClassIds).toBeNull();
  });

  it("returns the credit ledger in order", async () => {
    const rows = await creditEntries(testDb(), "pat_05");
    expect(rows[0]).toMatchObject({ type: "top_up", amountCentavos: 500_000 });
    expect(rows).toHaveLength(6);
  });
});
