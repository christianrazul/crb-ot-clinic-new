import "server-only";

import { hashPassword } from "better-auth/crypto";
import { and, asc, eq, inArray, isNull, max, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { ROLES } from "@/lib/roles";
import type { Actor } from "@/server/auth/actor";
import { assertCan } from "@/server/auth/permissions";
import type { DbExecutor } from "@/server/db/client";
import { writeAudit } from "@/server/db/queries/audit";
import {
  accounts,
  auditLog,
  branches,
  sessions,
  staff,
  userBranches,
  users,
} from "@/server/db/schema";

import { NotFoundError, ValidationError } from "./errors";

export const createAccountInput = z.object({
  name: z.string().trim().min(2, "Enter the person's full name."),
  email: z.email("Enter a valid email address."),
  role: z.enum(ROLES),
  branchIds: z.array(z.string()).min(1, "Pick at least one branch."),
  /** Link to an existing staff record (therapists). */
  staffId: z.string().optional(),
});

/**
 * The clinic owner creates every account (self sign-up is off). The account
 * gets an unusable random password; the caller then sends an invite
 * (auth/invites.ts) so the person chooses their own.
 */
export async function createAccount(db: DbExecutor, actor: Actor, raw: unknown) {
  assertCan(actor, "user:manage");
  const input = createAccountInput.parse(raw);
  for (const branchId of input.branchIds) assertCan(actor, "user:manage", { branchId });

  const email = input.email.toLowerCase();
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email));
  if (taken) throw new ValidationError("That email already has an account.");
  if (input.staffId) {
    const [member] = await db.select().from(staff).where(eq(staff.id, input.staffId));
    if (!member) throw new NotFoundError();
    assertCan(actor, "user:manage", { branchId: member.branchId });
    if (member.userId) throw new ValidationError("That staff member already has a login.");
    if (input.role !== "therapist") {
      throw new ValidationError("Staff logins are therapist accounts.");
    }
    if (!input.branchIds.includes(member.branchId)) input.branchIds.push(member.branchId);
  } else if (input.role === "therapist") {
    throw new ValidationError(
      "Therapist logins come from a staff member. Add them under Staff, or give an existing staff member a login.",
    );
  }

  const userId = crypto.randomUUID();
  const randomPassword = crypto.randomUUID() + crypto.randomUUID();
  await db
    .insert(users)
    .values({ id: userId, name: input.name, email, role: input.role, emailVerified: true });
  await db.insert(accounts).values({
    accountId: userId,
    providerId: "credential",
    userId,
    password: await hashPassword(randomPassword),
  });
  await db.insert(userBranches).values(input.branchIds.map((branchId) => ({ userId, branchId })));
  if (input.staffId) await db.update(staff).set({ userId }).where(eq(staff.id, input.staffId));

  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "user.create",
    entity: "user",
    entityId: userId,
    after: {
      name: input.name,
      email,
      role: input.role,
      branchIds: input.branchIds,
      staffId: input.staffId ?? null,
    },
    ip: actor.ip,
  });
  return { userId, email };
}

export type TeamStatus = "active" | "invited" | "turned_off" | "locked";

/**
 * Every account that shares a branch with the owner, with how far along it
 * is: invited (never signed in), active, locked after wrong passwords, or
 * turned off. Last sign-in comes from the audit log.
 */
export async function listTeam(db: DbExecutor, actor: Actor) {
  assertCan(actor, "user:manage");
  const memberships = await db
    .select({ userId: userBranches.userId, branchId: branches.id, branchName: branches.name })
    .from(userBranches)
    .innerJoin(branches, eq(userBranches.branchId, branches.id))
    .orderBy(asc(branches.code));
  const visible = new Set(
    memberships.filter((m) => actor.branchIds.includes(m.branchId)).map((m) => m.userId),
  );
  if (!visible.size) return { accounts: [], staffWithoutLogin: [] };

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
      lockedUntil: users.lockedUntil,
      createdAt: users.createdAt,
      staffId: staff.id,
      staffName: staff.displayName,
    })
    .from(users)
    .leftJoin(staff, eq(staff.userId, users.id))
    .where(inArray(users.id, [...visible]))
    .orderBy(asc(users.name));
  const signIns = await db
    .select({ userId: auditLog.entityId, at: max(auditLog.createdAt) })
    .from(auditLog)
    .where(and(eq(auditLog.action, "auth.sign_in"), inArray(auditLog.entityId, [...visible])))
    .groupBy(auditLog.entityId);
  const lastSignIn = new Map(signIns.map((r) => [r.userId, r.at]));
  const now = new Date();

  const unlinked = await db
    .select({ id: staff.id, displayName: staff.displayName, branchId: staff.branchId })
    .from(staff)
    .where(
      and(isNull(staff.userId), eq(staff.active, true), inArray(staff.branchId, actor.branchIds)),
    )
    .orderBy(asc(staff.displayName));

  return {
    accounts: rows.map((r) => {
      const last = lastSignIn.get(r.id) ?? null;
      const status: TeamStatus = !r.active
        ? "turned_off"
        : r.lockedUntil && r.lockedUntil > now
          ? "locked"
          : last
            ? "active"
            : "invited";
      return {
        id: r.id,
        name: r.name,
        email: r.email,
        role: r.role,
        status,
        isYou: r.id === actor.userId,
        lastSignInAt: last?.toISOString() ?? null,
        invitedAt: r.createdAt.toISOString(),
        staff: r.staffId ? { id: r.staffId, name: r.staffName! } : null,
        branches: memberships
          .filter((m) => m.userId === r.id)
          .map((m) => ({ id: m.branchId, name: m.branchName })),
      };
    }),
    staffWithoutLogin: unlinked,
  };
}
export type TeamData = Awaited<ReturnType<typeof listTeam>>;

/** An owner can't lock the clinic out of its own settings. */
async function assertAnotherOwnerRemains(db: DbExecutor, userId: string) {
  const [other] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, "superadmin"), eq(users.active, true), ne(users.id, userId)))
    .limit(1);
  if (!other) throw new ValidationError("The clinic needs at least one active owner.");
}

async function accountFor(db: DbExecutor, actor: Actor, userId: string) {
  assertCan(actor, "user:manage");
  const [user] = await db.select().from(users).where(eq(users.id, userId)).for("update");
  if (!user) throw new NotFoundError();
  const theirs = await db
    .select({ branchId: userBranches.branchId })
    .from(userBranches)
    .where(eq(userBranches.userId, userId));
  // Only accounts in one of the owner's branches.
  if (!theirs.some((b) => actor.branchIds.includes(b.branchId))) throw new NotFoundError();
  return { user, branchIds: theirs.map((b) => b.branchId) };
}

export const updateAccountInput = z.object({
  userId: z.string().min(1).max(64),
  role: z.enum(ROLES),
  branchIds: z.array(z.string().min(1).max(64)).min(1, "Pick at least one branch.").max(20),
});

/** Changes someone's role or branches. Therapist accounts stay tied to their staff record. */
export async function updateAccount(db: DbExecutor, actor: Actor, raw: unknown) {
  const input = updateAccountInput.parse(raw);
  const { user, branchIds: before } = await accountFor(db, actor, input.userId);
  for (const branchId of input.branchIds) assertCan(actor, "user:manage", { branchId });
  // Branches outside the owner's reach stay as they were.
  const kept = before.filter((b) => !actor.branchIds.includes(b));
  const next = [...new Set([...kept, ...input.branchIds])];

  if (input.userId === actor.userId && input.role !== user.role) {
    throw new ValidationError("You can't change your own role. Ask another owner.");
  }
  if (user.role === "superadmin" && input.role !== "superadmin") {
    await assertAnotherOwnerRemains(db, user.id);
  }
  const [linked] = await db.select({ id: staff.id }).from(staff).where(eq(staff.userId, user.id));
  if (linked && input.role !== "therapist") {
    throw new ValidationError(
      "This login belongs to a staff member, so it stays a therapist account.",
    );
  }
  if (!linked && input.role === "therapist") {
    throw new ValidationError(
      "Therapist logins come from a staff member. Add them under Staff, or give an existing staff member a login.",
    );
  }

  await db.update(users).set({ role: input.role }).where(eq(users.id, user.id));
  await db.delete(userBranches).where(eq(userBranches.userId, user.id));
  await db.insert(userBranches).values(next.map((branchId) => ({ userId: user.id, branchId })));
  // New permissions apply on the next request; sign them out so nothing stale lingers.
  if (input.role !== user.role) await db.delete(sessions).where(eq(sessions.userId, user.id));
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "user.update",
    entity: "user",
    entityId: user.id,
    before: { role: user.role, branchIds: before },
    after: { role: input.role, branchIds: next },
    ip: actor.ip,
  });
}

/**
 * Turning an account off signs the person out everywhere at once and blocks
 * sign-in; their history stays. Turning it back on lets them sign in again
 * with their old password.
 */
export async function setAccountActive(
  db: DbExecutor,
  actor: Actor,
  input: { userId: string; active: boolean },
) {
  const { user } = await accountFor(db, actor, input.userId);
  if (!input.active) {
    if (user.id === actor.userId) throw new ValidationError("You can't turn off your own account.");
    if (user.role === "superadmin") await assertAnotherOwnerRemains(db, user.id);
  }
  await db.update(users).set({ active: input.active }).where(eq(users.id, user.id));
  if (!input.active) await db.delete(sessions).where(eq(sessions.userId, user.id));
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "user.status",
    entity: "user",
    entityId: user.id,
    before: { active: user.active },
    after: { active: input.active },
    ip: actor.ip,
  });
}

/** Checks the owner may re-invite this person; the email goes out after the transaction. */
export async function prepareReinvite(db: DbExecutor, actor: Actor, userId: string) {
  const { user } = await accountFor(db, actor, userId);
  if (!user.active) throw new ValidationError("Turn the account on before sending an invite.");
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "user.invite",
    entity: "user",
    entityId: user.id,
    ip: actor.ip,
  });
  return { userId: user.id, email: user.email };
}
