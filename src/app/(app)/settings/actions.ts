"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { runAction } from "@/server/actions/run-action";
import { requestPasswordReset } from "@/server/auth/password-reset";
import {
  createBranch,
  createSessionType,
  createStaff,
  removeSessionType,
  setStaffActive,
  updateBranchHours,
  updateRateClasses,
  updateSessionTypeRate,
} from "@/server/services/settings";
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
  // After the transaction commits: email the new user a link to set their password.
  if (result.ok && result.data.account) {
    const requestHeaders = await headers();
    await requestPasswordReset(
      result.data.account.email,
      requestHeaders,
      requestHeaders.get("x-forwarded-for"),
    );
  }
  return result.ok
    ? { ok: true as const, data: { invited: Boolean(result.data.account) } }
    : result;
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
