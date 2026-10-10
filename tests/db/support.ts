import { afterAll, inject } from "vitest";

import { createDb, type Database, type DbExecutor } from "@/server/db/client";

let shared: ReturnType<typeof createDb> | undefined;

/** One connection pool per test file, closed when the file finishes. */
export function testDb(): Database {
  if (!shared) {
    shared = createDb(inject("databaseUrl"), { max: 3 });
    afterAll(async () => {
      await shared?.client.end();
      shared = undefined;
    });
  }
  return shared.db;
}

class Rollback extends Error {}

/** Runs the test body in a transaction that is always rolled back, so tests never see each other's writes. */
export async function inRollback(body: (tx: DbExecutor) => Promise<void>) {
  try {
    await testDb().transaction(async (tx) => {
      await body(tx);
      throw new Rollback();
    });
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

/** The Postgres error code (e.g. 23P01) behind a failed query, unwrapping Drizzle's error. */
export function pgCode(error: unknown): string | undefined {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.cause?.code ?? e?.code;
}

/** Runs a query in a savepoint and returns the Postgres error code it failed with. */
export async function failureCode(tx: DbExecutor, body: (tx: DbExecutor) => Promise<unknown>) {
  try {
    await tx.transaction(async (savepoint) => {
      await body(savepoint);
    });
  } catch (error) {
    return pgCode(error);
  }
  return undefined;
}

export const PG = {
  exclusionViolation: "23P01",
  checkViolation: "23514",
  uniqueViolation: "23505",
  foreignKeyViolation: "23503",
  restrictViolation: "23001",
} as const;
