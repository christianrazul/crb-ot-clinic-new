import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, inject } from "vitest";

import { bootstrapClinic } from "@/server/bootstrap";
import { createDb } from "@/server/db/client";
import { runMigrations } from "@/server/db/migrate";
import { branches, rateClasses, receiptCounters, userBranches, users } from "@/server/db/schema";

const input = {
  ownerEmail: "Owner@Clinic.test",
  ownerName: "Camelia Boquia",
  branchName: "CRB Bangkal",
  branchLocation: "Davao City",
};

// An empty, migrated database of its own: the shared test database is seeded.
const url = new URL(inject("databaseUrl"));
url.pathname = "/crb_bootstrap_test";
const admin = new URL(url);
admin.pathname = "/postgres";
let handle: ReturnType<typeof createDb>;

beforeAll(async () => {
  const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
  await sql.unsafe(`DROP DATABASE IF EXISTS crb_bootstrap_test WITH (FORCE)`);
  await sql.unsafe(`CREATE DATABASE crb_bootstrap_test`);
  await sql.end();
  await runMigrations(url.toString());
  handle = createDb(url.toString(), { max: 2 });
});

afterAll(async () => {
  await handle?.client.end();
  const sql = postgres(admin.toString(), { max: 1, onnotice: () => {} });
  await sql.unsafe(`DROP DATABASE IF EXISTS crb_bootstrap_test WITH (FORCE)`);
  await sql.end();
});

describe("first-boot bootstrap", () => {
  it("creates the rate classes, main branch and owner once", async () => {
    const db = handle.db;
    expect(await bootstrapClinic(db, input)).toBe("owner@clinic.test");

    const [owner] = await db.select().from(users);
    expect(owner).toMatchObject({ email: "owner@clinic.test", role: "superadmin", active: true });
    const [branch] = await db.select().from(branches);
    expect(branch).toMatchObject({ name: "CRB Bangkal", isMain: true, code: "B1" });
    expect(
      await db.select().from(userBranches).where(eq(userBranches.userId, owner!.id)),
    ).toHaveLength(1);
    expect(await db.select().from(rateClasses)).toHaveLength(4);
    expect(await db.select().from(receiptCounters)).toEqual([
      { branchId: branch!.id, nextNumber: 1 },
    ]);

    // Every later boot leaves it alone.
    expect(await bootstrapClinic(db, { ...input, ownerEmail: "someone@else.test" })).toBeNull();
    expect(await db.select().from(users)).toHaveLength(1);
  });
});
