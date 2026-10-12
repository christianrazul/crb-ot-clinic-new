import { describe, expect, it } from "vitest";

import { can } from "@/server/auth/permissions";

import { ACTORS } from "../support/actors";

describe("can", () => {
  it("gives the owner everything at their branches", () => {
    for (const action of [
      "dashboard:read",
      "payroll:read",
      "settings:manage",
      "billing:read",
      "audit:read",
    ] as const) {
      expect(can(ACTORS.owner, action, { branchId: "br_panabo" })).toBe(true);
    }
  });

  it("gives the front desk billing but not payroll, settings or the dashboard", () => {
    expect(can(ACTORS.desk, "billing:read", { branchId: "br_bangkal" })).toBe(true);
    expect(can(ACTORS.desk, "credit:top-up", { branchId: "br_bangkal" })).toBe(true);
    expect(can(ACTORS.desk, "payroll:read")).toBe(false);
    expect(can(ACTORS.desk, "settings:manage")).toBe(false);
    expect(can(ACTORS.desk, "dashboard:read")).toBe(false);
  });

  it("scopes everyone to their branches", () => {
    expect(can(ACTORS.desk, "billing:read", { branchId: "br_panabo" })).toBe(false);
    expect(
      can(ACTORS.therapist, "patient:read", { branchId: "br_panabo", ownedByActor: true }),
    ).toBe(false);
  });

  it("lets therapists read every patient but edit only their own, and keeps them from money and status changes", () => {
    expect(
      can(ACTORS.therapist, "patient:read", { branchId: "br_bangkal", ownedByActor: false }),
    ).toBe(true);
    expect(
      can(ACTORS.therapist, "patient:edit", { branchId: "br_bangkal", ownedByActor: false }),
    ).toBe(false);
    expect(can(ACTORS.therapist, "note:write", { ownedByActor: true })).toBe(true);
    for (const action of [
      "billing:read",
      "credit:read",
      "payment:collect",
      "appointment:status",
      "payroll:read",
    ] as const) {
      expect(can(ACTORS.therapist, action, { branchId: "br_bangkal" })).toBe(false);
    }
  });

  it("only therapists write session notes", () => {
    expect(can(ACTORS.desk, "note:write")).toBe(false);
    expect(can(ACTORS.owner, "note:write")).toBe(false);
  });
});
