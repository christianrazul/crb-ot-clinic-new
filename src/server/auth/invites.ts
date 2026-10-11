import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, eq, gt } from "drizzle-orm";

import { env } from "@/env";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import type { DbExecutor } from "@/server/db/client";
import { branches, userBranches, users, verifications } from "@/server/db/schema";

import { sendEmail } from "./email";
import { takeRateLimit } from "./rate-limit";

/** Invites last longer than password resets (1 hour): people don't always check email straight away. */
export const INVITE_HOURS = 72;
const INVITES_PER_USER_PER_HOUR = 5;

/** Same as Better Auth's hashed identifier storage: SHA-256, base64url without padding. */
function storedIdentifier(token: string) {
  return createHash("sha256").update(`reset-password:${token}`).digest("base64url");
}

/**
 * A one-time "set your password" token, written to Better Auth's
 * verifications table in its own format, so its reset endpoint
 * (resetPasswordAction) accepts it exactly like a forgot-password token. An
 * end-to-end test sets a password through it.
 */
async function createInviteToken(db: DbExecutor, userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.insert(verifications).values({
    id: crypto.randomUUID(),
    identifier: storedIdentifier(token),
    value: userId,
    expiresAt: new Date(Date.now() + INVITE_HOURS * 60 * 60_000),
  });
  return token;
}

export type InviteResult = { sent: true } | { sent: false; reason: "limited" | "failed" };

/**
 * Emails a new or existing account a link to set their password. Unlike the
 * forgot-password form, the result is reported back, so the owner knows when
 * an invite did not go out. Limited per invitee, not per IP, so the owner can
 * onboard a whole team at once. Never logs the link: it holds the token.
 */
export async function sendInvite(db: DbExecutor, userId: string): Promise<InviteResult> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user || !user.active) return { sent: false, reason: "failed" };
  if (!(await takeRateLimit(db, `invite:${userId}`, INVITES_PER_USER_PER_HOUR, 60 * 60_000))) {
    return { sent: false, reason: "limited" };
  }
  const branchNames = (
    await db
      .select({ name: branches.name })
      .from(userBranches)
      .innerJoin(branches, eq(userBranches.branchId, branches.id))
      .where(eq(userBranches.userId, userId))
  ).map((b) => b.name);
  const token = await createInviteToken(db, userId);
  const url = `${env.NEXT_PUBLIC_APP_URL}/reset-password?token=${encodeURIComponent(token)}&invite=1`;
  const role = ROLE_LABELS[user.role as Role] ?? user.role;
  try {
    await sendEmail({
      to: user.email,
      subject: "You're invited to CRB OT Clinic",
      text:
        `Hi ${user.name.split(" ")[0]},\n\n` +
        `You've been added to CRB OT Clinic as ${role}` +
        (branchNames.length ? ` at ${branchNames.join(" and ")}` : "") +
        `.\n\nChoose your password here (the link works for ${INVITE_HOURS / 24} days):\n${url}\n\n` +
        `Then sign in at ${env.NEXT_PUBLIC_APP_URL}/login with ${user.email}.\n\n` +
        `If you weren't expecting this, you can ignore this email.`,
    });
    return { sent: true };
  } catch (error) {
    console.error(
      `Invite email to user ${userId} failed:`,
      error instanceof Error ? error.message : error,
    );
    return { sent: false, reason: "failed" };
  }
}

/** Who an invite link is for, to greet them by name. Null if it has expired or was used. */
export async function describeInvite(db: DbExecutor, token: string) {
  const [verification] = await db
    .select()
    .from(verifications)
    .where(
      and(
        eq(verifications.identifier, storedIdentifier(token)),
        gt(verifications.expiresAt, new Date()),
      ),
    );
  if (!verification) return null;
  const [user] = await db.select().from(users).where(eq(users.id, verification.value));
  if (!user || !user.active) return null;
  const memberships = await db
    .select({ name: branches.name })
    .from(userBranches)
    .innerJoin(branches, eq(userBranches.branchId, branches.id))
    .where(eq(userBranches.userId, user.id));
  return {
    firstName: user.name.split(" ")[0]!,
    email: user.email,
    roleLabel: ROLE_LABELS[user.role as Role] ?? user.role,
    branchNames: memberships.map((m) => m.name),
  };
}
