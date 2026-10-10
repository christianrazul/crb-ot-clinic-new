import { count, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import { creditBalance } from "@/server/db/queries/billing";
import * as t from "@/server/db/schema";

import { testDb } from "./support";

describe("seed", () => {
  const total = async (table: PgTable) => (await testDb().select({ n: count() }).from(table))[0]!.n;

  it("recreates the mockup's clinic", async () => {
    expect(await total(t.branches)).toBe(2);
    expect(await total(t.staff)).toBe(5);
    expect(await total(t.patients)).toBe(16);
    expect(await total(t.guardians)).toBe(16);
    expect(await total(t.rateClasses)).toBe(4);
    expect(await total(t.sessionTypes)).toBe(5);
    expect(await total(t.users)).toBe(3);
  });

  it("has fourteen sessions on the demo Saturday", async () => {
    const [row] = await testDb().execute<{ n: number }>(
      sql`select count(*)::int as n from appointments where (starts_at at time zone 'Asia/Manila')::date = '2026-08-22'`,
    );
    expect(row!.n).toBe(14);
  });

  it("loads the three credit ledgers with their mockup balances", async () => {
    expect(await creditBalance(testDb(), "pat_01")).toBe(420_000); // Liam Santos
    expect(await creditBalance(testDb(), "pat_03")).toBe(490_000); // Enzo Dela Peña
    expect(await creditBalance(testDb(), "pat_05")).toBe(70_000); // Althea Mendoza
    expect(await creditBalance(testDb(), "pat_02")).toBe(0);
  });

  it("snapshots payroll rate and share on every attended session", async () => {
    const [row] = await testDb().execute<{ n: number }>(
      sql`select count(*)::int as n from appointments where status = 'attended' and (payroll_rate_centavos is null or payroll_share_pct is null)`,
    );
    expect(row!.n).toBe(0);
  });
});
