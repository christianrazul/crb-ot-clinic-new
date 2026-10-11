"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { runAction } from "@/server/actions/run-action";
import { getCreditLedger } from "@/server/services/billing";
import { collectPayment, getPaymentContext, recordTopUp } from "@/server/services/payments";

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
