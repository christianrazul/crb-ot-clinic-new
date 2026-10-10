import "server-only";

import { env } from "@/env";
import type { Role } from "@/lib/roles";
import { SEED_USERS } from "@/server/db/seed/seed-data";

import { auth } from "./auth";
import { signInWithPassword } from "./sign-in";

/**
 * Development only: switch to the seeded account for a role. Refused unless
 * the switcher flag is on, which the env schema forbids in production.
 */
export async function signInAsSeedUser(role: Role, requestHeaders: Headers) {
  if (!env.NEXT_PUBLIC_DEV_ROLE_SWITCHER || env.NODE_ENV === "production" || !env.SEED_PASSWORD) {
    throw new Error("The role switcher is disabled.");
  }
  const seedUser = SEED_USERS.find((u) => u.role === role)!;
  await auth.api.signOut({ headers: requestHeaders });
  const result = await signInWithPassword({
    email: seedUser.email,
    password: env.SEED_PASSWORD,
    headers: requestHeaders,
    ip: requestHeaders.get("x-forwarded-for"),
  });
  if (!result.ok) throw new Error(result.message);
}
