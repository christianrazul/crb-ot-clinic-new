"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { runAction } from "@/server/actions/run-action";
import { getCreditLedger } from "@/server/services/billing";
import {
  adjustCredit,
  collectPayment,
  correctPayment,
  correctTopUp,
  getPaymentContext,
  getPaymentCorrectionContext,
  recordTopUp,
  voidCreditEntry,
  voidPayment,
} from "@/server/services/payments";

const id = z.string().min(1).max(64);
const refreshed = <T extends { ok: boolean }>(result: T) => {
  if (result.ok) revalidatePath("/", "layout");
  return result;
};

export async function getPaymentContextAction(appointmentId: unknown) {
  return runAction(({ db, actor }) => getPaymentContext(db, actor, id.parse(appointmentId)), {
    transaction: false,
  });
}

export async function collectPaymentAction(input: unknown) {
  return refreshed(await runAction(({ db, actor }) => collectPayment(db, actor, input)));
}

/** Current credit balance, for the advance payment dialog. */
export async function getCreditBalanceAction(patientId: unknown) {
  return runAction(
    async ({ db, actor }) => (await getCreditLedger(db, actor, id.parse(patientId))).balance,
    { transaction: false },
  );
}

export async function recordTopUpAction(input: unknown) {
  return refreshed(await runAction(({ db, actor }) => recordTopUp(db, actor, input)));
}

// Corrections: void with a reason, or void and record the corrected entry (D-121).

export async function getPaymentCorrectionAction(paymentId: unknown) {
  return runAction(({ db, actor }) => getPaymentCorrectionContext(db, actor, id.parse(paymentId)), {
    transaction: false,
  });
}

export async function voidPaymentAction(paymentId: unknown, reason: unknown) {
  return refreshed(
    await runAction(async ({ db, actor }) => {
      await voidPayment(db, actor, { paymentId: id.parse(paymentId), reason });
    }),
  );
}

export async function correctPaymentAction(paymentId: unknown, reason: unknown, payment: unknown) {
  return refreshed(
    await runAction(({ db, actor }) =>
      correctPayment(db, actor, { paymentId: id.parse(paymentId), reason, payment }),
    ),
  );
}

export async function voidCreditEntryAction(entryId: unknown, reason: unknown) {
  return refreshed(
    await runAction(async ({ db, actor }) => {
      await voidCreditEntry(db, actor, { entryId: id.parse(entryId), reason });
    }),
  );
}

export async function correctTopUpAction(entryId: unknown, reason: unknown, topUp: unknown) {
  return refreshed(
    await runAction(({ db, actor }) =>
      correctTopUp(db, actor, { entryId: id.parse(entryId), reason, topUp }),
    ),
  );
}

export async function adjustCreditAction(input: unknown) {
  return refreshed(await runAction(({ db, actor }) => adjustCredit(db, actor, input)));
}
