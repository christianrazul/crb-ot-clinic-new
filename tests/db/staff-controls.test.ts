import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { ForbiddenError } from "@/server/auth/permissions";
import { auditLog, sessions, staff, users } from "@/server/db/schema";
import { setStaffActive, updateStaff } from "@/server/services/settings";
import { createAccount, updateAccount } from "@/server/services/users";

import { ACTORS } from "../support/actors";
import { inRollback } from "./support";

const session = (userId: string) => ({
  id: crypto.randomUUID(),
  userId,
  token: crypto.randomUUID(),
  expiresAt: new Date(Date.now() + 86_400_000),
});

describe("editing staff", () => {
  it("renames and changes role, keeps the login name in step, and audits it", () =>
    inRollback(async (tx) => {
      await updateStaff(tx, ACTORS.owner, {
        id: "stf_delarosa",
        displayName: "Jolyn Reyes, OTRP",
        rateClassId: "rc_ot_aide",
      });
      const [row] = await tx.select().from(staff).where(eq(staff.id, "stf_delarosa"));
      expect(row).toMatchObject({
        displayName: "Jolyn Reyes, OTRP",
        shortName: "J. Reyes, OTRP",
        surname: "Reyes",
        rateClassId: "rc_ot_aide",
      });
      const [login] = await tx.select().from(users).where(eq(users.id, "usr_ther_delarosa"));
      expect(login!.name).toBe("Jolyn Reyes");
      const [entry] = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.action, "staff.update"), eq(auditLog.entityId, "stf_delarosa")));
      expect(entry).toMatchObject({
        before: { rateClassId: "rc_ot" },
        after: { rateClassId: "rc_ot_aide" },
      });

      await expect(
        updateStaff(tx, ACTORS.desk, { id: "stf_ramos", displayName: "X Y", rateClassId: "rc_ot" }),
      ).rejects.toBeInstanceOf(ForbiddenError);
      await expect(
        updateStaff(tx, ACTORS.owner, {
          id: "stf_ramos",
          displayName: "Marco Tan",
          rateClassId: "nope",
        }),
      ).rejects.toThrow(/Pick a role/);
    }));

  it("setting staff inactive turns off their login and signs them out; active restores it", () =>
    inRollback(async (tx) => {
      await tx.insert(sessions).values(session("usr_ther_delarosa"));
      expect(await setStaffActive(tx, ACTORS.owner, { id: "stf_delarosa", active: false })).toEqual(
        {
          loginChanged: true,
        },
      );
      let [login] = await tx.select().from(users).where(eq(users.id, "usr_ther_delarosa"));
      expect(login!.active).toBe(false);
      expect(
        await tx.select().from(sessions).where(eq(sessions.userId, "usr_ther_delarosa")),
      ).toHaveLength(0);

      await setStaffActive(tx, ACTORS.owner, { id: "stf_delarosa", active: true });
      [login] = await tx.select().from(users).where(eq(users.id, "usr_ther_delarosa"));
      expect(login!.active).toBe(true);
      // Staff with no login: only the staff record changes.
      expect(await setStaffActive(tx, ACTORS.owner, { id: "stf_ramos", active: false })).toEqual({
        loginChanged: false,
      });
    }));
});

describe("editing team accounts", () => {
  it("changes name and email, refuses a taken email, and signs them out on a new email", () =>
    inRollback(async (tx) => {
      await tx.insert(sessions).values(session("usr_desk"));
      const base = { userId: "usr_desk", role: "secretary", branchIds: ["br_bangkal"] } as const;
      await expect(
        updateAccount(tx, ACTORS.owner, {
          ...base,
          name: "Jo Lauron",
          email: "camelia@crbclinic.test",
        }),
      ).rejects.toThrow(/already has an account/);

      // Same email: no sign-out.
      await updateAccount(tx, ACTORS.owner, {
        ...base,
        name: "Joanna Lauron",
        email: "jo@crbclinic.test",
      });
      expect(await tx.select().from(sessions).where(eq(sessions.userId, "usr_desk"))).toHaveLength(
        1,
      );

      await updateAccount(tx, ACTORS.owner, {
        ...base,
        name: "Joanna Lauron",
        email: "Joanna@CRBclinic.test",
      });
      const [row] = await tx.select().from(users).where(eq(users.id, "usr_desk"));
      expect(row).toMatchObject({ name: "Joanna Lauron", email: "joanna@crbclinic.test" });
      expect(await tx.select().from(sessions).where(eq(sessions.userId, "usr_desk"))).toHaveLength(
        0,
      );
    }));

  it("an owner can edit their own name and email without being signed out", () =>
    inRollback(async (tx) => {
      await tx.insert(sessions).values(session("usr_owner"));
      await updateAccount(tx, ACTORS.owner, {
        userId: "usr_owner",
        name: "Camelia R. Boquia",
        email: "owner@crbotclinic.test",
        role: "superadmin",
        branchIds: ["br_bangkal", "br_panabo"],
      });
      expect(await tx.select().from(sessions).where(eq(sessions.userId, "usr_owner"))).toHaveLength(
        1,
      );
      // The old address is free again.
      await expect(
        createAccount(tx, ACTORS.owner, {
          name: "New Desk",
          email: "camelia@crbclinic.test",
          role: "secretary",
          branchIds: ["br_bangkal"],
        }),
      ).resolves.toMatchObject({ email: "camelia@crbclinic.test" });
    }));
});
