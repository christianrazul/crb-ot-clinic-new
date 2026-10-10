import "server-only";

import { hashPassword } from "better-auth/crypto";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

import { ROLES } from "@/lib/roles";
import type { Actor } from "@/server/auth/actor";
import { assertCan } from "@/server/auth/permissions";
import type { DbExecutor } from "@/server/db/client";
import { writeAudit } from "@/server/db/queries/audit";
import { accounts, staff, userBranches, users } from "@/server/db/schema";

import { ValidationError } from "./errors";

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
 * gets a random password; the new user sets their own through "Forgot
 * password", which the caller triggers by sending a reset link.
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
