import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import {
  clearFailedLogins,
  isLocked,
  MAX_FAILED_LOGINS,
  recordFailedLogin,
} from "@/server/auth/lockout";
import { takeRateLimit } from "@/server/auth/rate-limit";
import { users } from "@/server/db/schema";

import { inRollback } from "./support";

describe("login lockout", () => {
  it("locks the account on the fifth wrong password in a row, for 15 minutes", () =>
    inRollback(async (tx) => {
      const now = new Date("2026-08-22T02:00:00Z");
      for (let i = 1; i < MAX_FAILED_LOGINS; i++) {
        expect((await recordFailedLogin(tx, "usr_desk", now)).locked).toBe(false);
      }
      const fifth = await recordFailedLogin(tx, "usr_desk", now);
      expect(fifth.locked).toBe(true);
      expect(fifth.lockedUntil?.toISOString()).toBe("2026-08-22T02:15:00.000Z");
      expect(isLocked(fifth, new Date("2026-08-22T02:14:59Z"))).toBe(true);
      expect(isLocked(fifth, new Date("2026-08-22T02:15:01Z"))).toBe(false);
    }));

  it("a successful login clears the counter", () =>
    inRollback(async (tx) => {
      await recordFailedLogin(tx, "usr_desk");
      await recordFailedLogin(tx, "usr_desk");
      await clearFailedLogins(tx, "usr_desk");
      const [user] = await tx.select().from(users).where(eq(users.id, "usr_desk"));
      expect(user).toMatchObject({ failedLoginCount: 0, lockedUntil: null });
    }));
});

describe("rate limit", () => {
  it("allows max hits per window, then refuses", () =>
    inRollback(async (tx) => {
      const results = [];
      for (let i = 0; i < 4; i++) results.push(await takeRateLimit(tx, "test:ip", 3, 60_000));
      expect(results).toEqual([true, true, true, false]);
    }));
});
