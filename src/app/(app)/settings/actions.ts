"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { runAction } from "@/server/actions/run-action";
import { type InviteResult, sendInvite } from "@/server/auth/invites";
import { auditEntities, listAuditLog } from "@/server/services/audit";
import {
  createBranch,
  createSessionType,
  createStaff,
  removeSessionType,
  setStaffActive,
  updateBranchHours,
  updateRateClasses,
  updateSessionTypeRate,
  updateStaff,
} from "@/server/services/settings";
import {
  createAccount,
  prepareReinvite,
  setAccountActive,
  updateAccount,
} from "@/server/services/users";
import { currentBranchId } from "@/server/session/shell";

const id = z.string().min(1).max(64);
const done = <T extends { ok: boolean }>(result: T) => {
  if (result.ok) revalidatePath("/", "layout");
  return result;
};

export async function saveRatesAction(rows: unknown) {
  return done(await runAction(({ db, actor }) => updateRateClasses(db, actor, rows)));
}

export async function addSessionTypeAction(values: unknown) {
  return done(await runAction(({ db, actor }) => createSessionType(db, actor, values)));
}

export async function updateSessionTypeRateAction(sessionTypeId: unknown, ratePesos: unknown) {
  return done(
    await runAction(({ db, actor }) =>
      updateSessionTypeRate(db, actor, { id: id.parse(sessionTypeId), ratePesos }),
    ),
  );
}

export async function removeSessionTypeAction(sessionTypeId: unknown) {
  return done(
    await runAction(({ db, actor }) =>
      removeSessionType(db, actor, { id: id.parse(sessionTypeId) }),
    ),
  );
}

export async function addStaffAction(values: unknown) {
  const branchId = await currentBranchId();
  const result = done(
    await runAction(({ db, actor }) => createStaff(db, actor, { branchId, values })),
  );
  if (!result.ok) return result;
  // After the transaction commits: email the new user a link to set their password.
  const invite = result.data.account ? await inviteAfterCommit(result.data.account.userId) : null;
  return { ok: true as const, data: { account: Boolean(result.data.account), invite } };
}

/** Sends the invite once the account exists; reports whether it went out. */
async function inviteAfterCommit(userId: string): Promise<InviteResult> {
  const sent = await runAction(({ db }) => sendInvite(db, userId), { transaction: false });
  return sent.ok ? sent.data : { sent: false, reason: "failed" };
}

/** A front desk or owner account, or a login for an existing staff member. */
export async function addAccountAction(values: unknown) {
  const result = done(await runAction(({ db, actor }) => createAccount(db, actor, values)));
  if (!result.ok) return result;
  return { ok: true as const, data: { invite: await inviteAfterCommit(result.data.userId) } };
}

export async function resendInviteAction(userId: unknown) {
  const checked = await runAction(({ db, actor }) => prepareReinvite(db, actor, id.parse(userId)));
  if (!checked.ok) return checked;
  return { ok: true as const, data: { invite: await inviteAfterCommit(checked.data.userId) } };
}

export async function updateAccountAction(values: unknown) {
  return done(await runAction(({ db, actor }) => updateAccount(db, actor, values)));
}

export async function setAccountActiveAction(userId: unknown, active: unknown) {
  return done(
    await runAction(({ db, actor }) =>
      setAccountActive(db, actor, {
        userId: id.parse(userId),
        active: z.boolean().parse(active),
      }),
    ),
  );
}

export async function updateStaffAction(values: unknown) {
  return done(await runAction(({ db, actor }) => updateStaff(db, actor, values)));
}

export async function setStaffActiveAction(staffId: unknown, active: unknown) {
  return done(
    await runAction(({ db, actor }) =>
      setStaffActive(db, actor, { id: id.parse(staffId), active: z.boolean().parse(active) }),
    ),
  );
}

export async function addBranchAction(values: unknown) {
  const result = done(await runAction(({ db, actor }) => createBranch(db, actor, values)));
  return result.ok ? { ok: true as const, data: { name: result.data.name } } : result;
}

export async function saveHoursAction(values: unknown) {
  const branchId = await currentBranchId();
  return done(
    await runAction(({ db, actor }) => updateBranchHours(db, actor, { branchId, values })),
  );
}

export async function listAuditLogAction(query: unknown) {
  return runAction(
    async ({ db, actor }) => ({
      page: await listAuditLog(db, actor, query),
      entities: await auditEntities(db, actor),
    }),
    { transaction: false },
  );
}
