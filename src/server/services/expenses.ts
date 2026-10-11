import "server-only";

import { and, desc, eq, gte, lt } from "drizzle-orm";

import { expenseInput } from "@/lib/validation/expenses";
import type { Actor } from "@/server/auth/actor";
import { assertCan } from "@/server/auth/permissions";
import { clinicNow, clinicToday } from "@/server/clock";
import type { DbExecutor } from "@/server/db/client";
import { writeAudit } from "@/server/db/queries/audit";
import { expenses } from "@/server/db/schema";

import { ValidationError } from "./errors";

/** Records money the branch spent. Expenses are never edited or deleted; a mistake is corrected with a note. */
export async function recordExpense(
  db: DbExecutor,
  actor: Actor,
  input: { branchId: string; expense: unknown },
) {
  assertCan(actor, "expense:manage", { branchId: input.branchId });
  const expense = expenseInput.parse(input.expense);
  if (expense.spentOn > clinicToday()) throw new ValidationError("That date is in the future.");
  const [row] = await db
    .insert(expenses)
    .values({
      ...expense,
      branchId: input.branchId,
      createdByUserId: actor.userId,
      createdAt: clinicNow(),
    })
    .returning();
  await writeAudit(db, {
    actorUserId: actor.userId,
    action: "expense.create",
    entity: "expense",
    entityId: row!.id,
    after: { branchId: input.branchId, ...expense },
    ip: actor.ip,
  });
  return row!;
}

/** Expenses for a branch in [from, to), newest first. Dates are yyyy-MM-dd. */
export async function listExpenses(
  db: DbExecutor,
  actor: Actor,
  input: { branchId: string; from: string; to: string },
) {
  assertCan(actor, "expense:manage", { branchId: input.branchId });
  return db
    .select()
    .from(expenses)
    .where(
      and(
        eq(expenses.branchId, input.branchId),
        gte(expenses.spentOn, input.from),
        lt(expenses.spentOn, input.to),
      ),
    )
    .orderBy(desc(expenses.spentOn), desc(expenses.createdAt));
}
