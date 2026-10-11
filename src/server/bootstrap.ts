import "server-only";

import { hashPassword } from "better-auth/crypto";
import { count, sql } from "drizzle-orm";

import { RATE_CLASSES } from "@/lib/fixtures/rate-classes";
import type { Database } from "@/server/db/client";
import { writeAudit } from "@/server/db/queries/audit";
import {
  accounts,
  branches,
  clinicSettings,
  rateClasses,
  receiptCounters,
  userBranches,
  users,
} from "@/server/db/schema";

export type BootstrapInput = {
  ownerEmail: string;
  ownerName: string;
  branchName: string;
  branchLocation: string;
};

/**
 * First start of an empty production database: the four rate classes, clinic
 * settings, the main branch and the owner's account (with an unusable random
 * password). Does nothing once any user exists, so it is safe on every boot.
 * Returns the owner's email when it created the account, so the caller can
 * send a password reset link.
 */
export async function bootstrapClinic(db: Database, input: BootstrapInput) {
  return db.transaction(async (tx) => {
    // One bootstrap at a time, even with several app containers starting.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext('crb.bootstrap'))`);
    const [existing] = await tx.select({ n: count() }).from(users);
    if (existing!.n > 0) return null;

    await tx
      .insert(rateClasses)
      .values(RATE_CLASSES.map((r, index) => ({ ...r, sortOrder: index })))
      .onConflictDoNothing();
    await tx.insert(clinicSettings).values({ id: "clinic" }).onConflictDoNothing();
    const [branch] = await tx
      .insert(branches)
      .values({
        code: "B1",
        name: input.branchName,
        location: input.branchLocation || "Not set",
        isMain: true,
        receiptPrefix: "CRB",
      })
      .returning();
    await tx.insert(receiptCounters).values({ branchId: branch!.id, nextNumber: 1 });

    const userId = crypto.randomUUID();
    const email = input.ownerEmail.trim().toLowerCase();
    await tx.insert(users).values({
      id: userId,
      name: input.ownerName,
      email,
      role: "superadmin",
      emailVerified: true,
    });
    await tx.insert(accounts).values({
      accountId: userId,
      providerId: "credential",
      userId,
      password: await hashPassword(crypto.randomUUID() + crypto.randomUUID()),
    });
    await tx.insert(userBranches).values({ userId, branchId: branch!.id });
    await writeAudit(tx, {
      actorUserId: null,
      action: "clinic.bootstrap",
      entity: "user",
      entityId: userId,
      after: { email, branchId: branch!.id },
    });
    return email;
  });
}
