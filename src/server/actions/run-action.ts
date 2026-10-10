import "server-only";

import { ZodError } from "zod";

import type { Actor } from "@/server/auth/actor";
import { ForbiddenError } from "@/server/auth/permissions";
import { getActor } from "@/server/auth/session";
import { type DbExecutor, getDb } from "@/server/db/client";
import { NotFoundError, ValidationError } from "@/server/services/errors";

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Postgres constraint errors that can reach a user, explained in plain words. */
const PG_MESSAGES: Record<string, string> = {
  "23P01": "That time is already taken for this therapist or patient. Pick another time.",
  "23505": "That already exists. Check the list and try again.",
  "23503": "Something this refers to no longer exists. Reload the page and try again.",
  "23514": "Some details aren't valid. Check the form and try again.",
};

function postgresCode(error: unknown): string | undefined {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.cause?.code ?? e?.code;
}

/**
 * Runs a Server Action body: resolves the actor from the session (never from
 * the client), runs the service in one transaction, and turns known errors
 * into messages that explain what happened and what to do. Unknown errors are
 * logged without user input and reported generically.
 */
export async function runAction<T>(
  body: (ctx: { db: DbExecutor; actor: Actor }) => Promise<T>,
  options: { transaction?: boolean } = {},
): Promise<ActionResult<T>> {
  const actor = await getActor();
  if (!actor) return { ok: false, error: "Your session has ended. Log in again to continue." };
  try {
    const db = getDb();
    const data =
      options.transaction === false
        ? await body({ db, actor })
        : await db.transaction((tx) => body({ db: tx, actor }));
    return { ok: true, data };
  } catch (error) {
    if (
      error instanceof ForbiddenError ||
      error instanceof ValidationError ||
      error instanceof NotFoundError
    ) {
      return { ok: false, error: error.message };
    }
    if (error instanceof ZodError)
      return { ok: false, error: error.issues[0]?.message ?? "Check the form and try again." };
    const code = postgresCode(error);
    if (code && PG_MESSAGES[code]) return { ok: false, error: PG_MESSAGES[code] };
    // Log the error class and code only: messages can echo patient data.
    console.error(
      `[action] ${(error as Error)?.name ?? "Error"}${code ? ` (${code})` : ""}`,
      (error as Error)?.stack?.split("\n")[1]?.trim(),
    );
    return {
      ok: false,
      error:
        "Something went wrong on our side. Try again; if it keeps happening, tell the clinic owner.",
    };
  }
}
