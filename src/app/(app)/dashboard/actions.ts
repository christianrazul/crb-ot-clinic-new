"use server";

import { revalidatePath } from "next/cache";

import { runAction } from "@/server/actions/run-action";
import { recordExpense } from "@/server/services/expenses";
import { currentBranchId } from "@/server/session/shell";

export async function recordExpenseAction(expense: unknown) {
  const branchId = await currentBranchId();
  const result = await runAction(({ db, actor }) =>
    recordExpense(db, actor, { branchId, expense }).then(() => undefined),
  );
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
