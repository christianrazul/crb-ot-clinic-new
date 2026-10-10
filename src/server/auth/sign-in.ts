import "server-only";

import { APIError } from "better-auth/api";
import { eq, sql } from "drizzle-orm";

import { getDb } from "@/server/db/client";
import { writeAudit } from "@/server/db/queries/audit";
import { users } from "@/server/db/schema";

import { auth } from "./auth";
import { clearFailedLogins, isLocked, LOCKOUT_MINUTES, recordFailedLogin } from "./lockout";
import { takeRateLimit } from "./rate-limit";

export type SignInResult = { ok: true } | { ok: false; message: string };

const INVALID = "That email and password don't match. Check them and try again.";

/**
 * Email and password sign-in with rate limiting (10 tries per 15 minutes per
 * IP and email) and lockout (5 wrong passwords in a row locks for 15 minutes).
 * Messages never reveal whether an email has an account.
 */
export async function signInWithPassword(input: {
  email: string;
  password: string;
  headers: Headers;
  ip: string | null;
}): Promise<SignInResult> {
  const db = getDb();
  const email = input.email.trim().toLowerCase();

  const allowed = await takeRateLimit(
    db,
    `sign-in:${input.ip ?? "unknown"}:${email}`,
    10,
    15 * 60_000,
  );
  if (!allowed)
    return { ok: false, message: "Too many sign-in attempts. Wait 15 minutes, then try again." };

  const [user] = await db
    .select()
    .from(users)
    .where(eq(sql`lower(${users.email})`, email));
  if (user && isLocked(user)) {
    return {
      ok: false,
      message: `This account is locked for ${LOCKOUT_MINUTES} minutes after too many wrong passwords. Try again later or reset your password.`,
    };
  }
  if (user && !user.active) {
    return {
      ok: false,
      message: "This account is turned off. Ask the clinic owner to turn it back on.",
    };
  }

  try {
    await auth.api.signInEmail({
      body: { email, password: input.password },
      headers: input.headers,
    });
  } catch (error) {
    if (!(error instanceof APIError)) throw error;
    if (user) {
      const { locked } = await recordFailedLogin(db, user.id);
      await writeAudit(db, {
        actorUserId: user.id,
        action: "auth.sign_in_failed",
        entity: "user",
        entityId: user.id,
        ip: input.ip,
        after: { locked },
      });
      if (locked) {
        return {
          ok: false,
          message: `Too many wrong passwords. This account is locked for ${LOCKOUT_MINUTES} minutes.`,
        };
      }
    }
    return { ok: false, message: INVALID };
  }

  if (user) {
    await clearFailedLogins(db, user.id);
    await writeAudit(db, {
      actorUserId: user.id,
      action: "auth.sign_in",
      entity: "user",
      entityId: user.id,
      ip: input.ip,
    });
  }
  return { ok: true };
}
