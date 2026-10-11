"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { type ActionResult, runAction } from "@/server/actions/run-action";
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
import { setLowCreditThreshold } from "@/server/services/payments";
import { getShellSession } from "@/server/session/shell";

const id = z.string().min(1).max(64);
const done = <T extends { ok: boolean }>(result: T) => {
  if (result.ok) revalidatePath("/", "layout");
  return result;
};

/**
 * Branch-scoped settings are saved to the branch the form was loaded for, and
 * only if that is still the branch this person is working in. Switching
 * branches in another tab would otherwise save one branch's form into another.
 */
async function inBranch<T>(
  expected: unknown,
  work: (branchId: string) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const session = await getShellSession();
  if (id.safeParse(expected).data !== session.branch.id) {
    return {
      ok: false,
      error: `You've switched to ${session.branch.name} since this page loaded. Reload to edit ${session.branch.name}'s settings.`,
    };
  }
  return work(session.branch.id);
}

export async function saveRatesAction(branchId: unknown, rows: unknown) {
  return inBranch(branchId, async (branch) =>
    done(
      await runAction(({ db, actor }) => updateRateClasses(db, actor, { branchId: branch, rows })),
    ),
  );
}

export async function setLowCreditThresholdAction(branchId: unknown, pesos: unknown) {
  return inBranch(branchId, async (branch) =>
    done(
      await runAction(({ db, actor }) =>
        setLowCreditThreshold(db, actor, {
          branchId: branch,
          value: z.number().int().min(0).parse(pesos) * 100,
        }),
      ),
    ),
  );
}

export async function addSessionTypeAction(branchId: unknown, values: unknown) {
  return inBranch(branchId, async (branch) =>
    done(
      await runAction(({ db, actor }) =>
        createSessionType(db, actor, { branchId: branch, values }),
      ),
    ),
  );
}

export async function updateSessionTypeRateAction(
  branchId: unknown,
  sessionTypeId: unknown,
  ratePesos: unknown,
) {
  return inBranch(branchId, async (branch) =>
    done(
      await runAction(({ db, actor }) =>
        updateSessionTypeRate(db, actor, {
          branchId: branch,
          id: id.parse(sessionTypeId),
          ratePesos,
        }),
      ),
    ),
  );
}

export async function removeSessionTypeAction(branchId: unknown, sessionTypeId: unknown) {
  return inBranch(branchId, async (branch) =>
    done(
      await runAction(({ db, actor }) =>
        removeSessionType(db, actor, { branchId: branch, id: id.parse(sessionTypeId) }),
      ),
    ),
  );
}

export async function addStaffAction(branchId: unknown, values: unknown) {
  const result = await inBranch(branchId, async (branch) =>
    done(await runAction(({ db, actor }) => createStaff(db, actor, { branchId: branch, values }))),
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

export async function saveHoursAction(branchId: unknown, values: unknown) {
  return inBranch(branchId, async (branch) =>
    done(
      await runAction(({ db, actor }) =>
        updateBranchHours(db, actor, { branchId: branch, values }),
      ),
    ),
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
