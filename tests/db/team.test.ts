import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { describeInvite, sendInvite } from "@/server/auth/invites";
import { ForbiddenError } from "@/server/auth/permissions";
import { auditLog, sessions, staff, users, verifications } from "@/server/db/schema";
import { createAccount, listTeam, setAccountActive, updateAccount } from "@/server/services/users";

import { ACTORS } from "../support/actors";
import { inRollback } from "./support";

const secretary = {
  name: "Rita Cruz",
  email: "rita@example.test",
  role: "secretary",
  branchIds: ["br_bangkal"],
} as const;

const fakeSession = (userId: string) => ({
  id: crypto.randomUUID(),
  userId,
  token: crypto.randomUUID(),
  expiresAt: new Date(Date.now() + 86_400_000),
});

describe("team accounts", () => {
  it("lists everyone with their status; a new secretary shows as invited", () =>
    inRollback(async (tx) => {
      const { userId } = await createAccount(tx, ACTORS.owner, secretary);
      const team = await listTeam(tx, ACTORS.owner);
      const rita = team.accounts.find((a) => a.id === userId)!;
      expect(rita).toMatchObject({ role: "secretary", status: "invited", lastSignInAt: null });
      expect(rita.branches.map((b) => b.id)).toEqual(["br_bangkal"]);
      expect(team.accounts.find((a) => a.id === "usr_owner")).toMatchObject({ isYou: true });
      // Staff who can still be given a login.
      expect(team.staffWithoutLogin.map((s) => s.id)).toContain("stf_ramos");
      expect(team.staffWithoutLogin.map((s) => s.id)).not.toContain("stf_delarosa");

      await expect(listTeam(tx, ACTORS.desk)).rejects.toBeInstanceOf(ForbiddenError);
      await expect(listTeam(tx, ACTORS.therapist)).rejects.toBeInstanceOf(ForbiddenError);
    }));

  it("therapist logins must come from a staff member who has none yet", () =>
    inRollback(async (tx) => {
      await expect(
        createAccount(tx, ACTORS.owner, { ...secretary, role: "therapist" }),
      ).rejects.toThrow(/come from a staff member/);
      await expect(
        createAccount(tx, ACTORS.owner, {
          ...secretary,
          role: "therapist",
          staffId: "stf_delarosa",
        }),
      ).rejects.toThrow(/already has a login/);
      await expect(
        createAccount(tx, ACTORS.owner, { ...secretary, role: "secretary", staffId: "stf_ramos" }),
      ).rejects.toThrow(/therapist accounts/);

      const { userId } = await createAccount(tx, ACTORS.owner, {
        name: "Kevin Ramos",
        email: "kevin@example.test",
        role: "therapist",
        branchIds: ["br_bangkal"],
        staffId: "stf_ramos",
      });
      const [linked] = await tx.select().from(staff).where(eq(staff.id, "stf_ramos"));
      expect(linked!.userId).toBe(userId);
    }));

  it("changes role and branches, signs the person out, and keeps safeguards", () =>
    inRollback(async (tx) => {
      const { userId } = await createAccount(tx, ACTORS.owner, secretary);
      await tx.insert(sessions).values(fakeSession(userId));
      await updateAccount(tx, ACTORS.owner, {
        userId,
        role: "superadmin",
        branchIds: ["br_bangkal", "br_panabo"],
      });
      const [row] = await tx.select().from(users).where(eq(users.id, userId));
      expect(row!.role).toBe("superadmin");
      expect(await tx.select().from(sessions).where(eq(sessions.userId, userId))).toHaveLength(0);
      const [entry] = await tx
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.action, "user.update"), eq(auditLog.entityId, userId)));
      expect(entry).toMatchObject({ before: { role: "secretary" }, after: { role: "superadmin" } });

      // Your own role, a therapist's role, and the last owner are protected.
      await expect(
        updateAccount(tx, ACTORS.owner, {
          userId: "usr_owner",
          role: "secretary",
          branchIds: ["br_bangkal"],
        }),
      ).rejects.toThrow(/your own role/);
      await expect(
        updateAccount(tx, ACTORS.owner, {
          userId: "usr_ther_delarosa",
          role: "secretary",
          branchIds: ["br_bangkal"],
        }),
      ).rejects.toThrow(/stays a therapist/);
      await expect(
        updateAccount(tx, ACTORS.desk, { userId, role: "secretary", branchIds: ["br_bangkal"] }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    }));

  it("turning an account off signs them out; the owner can't turn off themselves or the last owner", () =>
    inRollback(async (tx) => {
      await tx.insert(sessions).values(fakeSession("usr_desk"));
      await setAccountActive(tx, ACTORS.owner, { userId: "usr_desk", active: false });
      const [desk] = await tx.select().from(users).where(eq(users.id, "usr_desk"));
      expect(desk!.active).toBe(false);
      expect(await tx.select().from(sessions).where(eq(sessions.userId, "usr_desk"))).toHaveLength(
        0,
      );
      expect(
        (await listTeam(tx, ACTORS.owner)).accounts.find((a) => a.id === "usr_desk")!.status,
      ).toBe("turned_off");
      await setAccountActive(tx, ACTORS.owner, { userId: "usr_desk", active: true });

      await expect(
        setAccountActive(tx, ACTORS.owner, { userId: "usr_owner", active: false }),
      ).rejects.toThrow(/your own account/);
      // A second owner may turn off the first, but not leave the clinic without one.
      const { userId: second } = await createAccount(tx, ACTORS.owner, {
        ...secretary,
        role: "superadmin",
      });
      const secondOwner = { ...ACTORS.owner, userId: second };
      await setAccountActive(tx, secondOwner, { userId: "usr_owner", active: false });
      await expect(
        updateAccount(tx, secondOwner, {
          userId: second,
          role: "secretary",
          branchIds: ["br_bangkal"],
        }),
      ).rejects.toThrow(/your own role/);
      await expect(
        setAccountActive(tx, ACTORS.owner, { userId: second, active: false }),
      ).rejects.toThrow(/at least one active owner/);
    }));
});

describe("invites", () => {
  it("stores only a hash of the token, greets the invitee, and is limited per person", () =>
    inRollback(async (tx) => {
      const { userId } = await createAccount(tx, ACTORS.owner, secretary);
      expect(await sendInvite(tx, userId)).toEqual({ sent: true });

      const [stored] = await tx.select().from(verifications).where(eq(verifications.value, userId));
      expect(stored!.identifier).not.toMatch(/^reset-password:/);
      const hours = (stored!.expiresAt.getTime() - Date.now()) / 3_600_000;
      expect(hours).toBeGreaterThan(71);

      // Find the token the email would carry by matching the stored hash.
      expect(await describeInvite(tx, "not-a-real-token")).toBeNull();
      const token = tokenFor(stored!.identifier);
      expect(await describeInvite(tx, token)).toMatchObject({
        firstName: "Rita",
        roleLabel: "Front desk",
        branchNames: ["CRB Bangkal"],
      });

      for (let i = 0; i < 4; i++) await sendInvite(tx, userId);
      expect(await sendInvite(tx, userId)).toEqual({ sent: false, reason: "limited" });

      await setAccountActive(tx, ACTORS.owner, { userId, active: false });
      expect(await describeInvite(tx, token)).toBeNull();
    }));
});

/** The invite token is random and stored hashed, so read it from the email (printed without SMTP) and check it matches. */
function tokenFor(identifier: string) {
  const token = lastInviteToken();
  const hash = createHash("sha256").update(`reset-password:${token}`).digest("base64url");
  expect(hash).toBe(identifier);
  return token;
}

let printed = "";
const original = console.info;
console.info = (...args: unknown[]) => {
  printed += args.join(" ") + "\n";
  original(...args);
};
function lastInviteToken() {
  const match = [...printed.matchAll(/token=([A-Za-z0-9_%-]+)&invite=1/g)].at(-1);
  if (!match) throw new Error("No invite email was printed.");
  return decodeURIComponent(match[1]!);
}
