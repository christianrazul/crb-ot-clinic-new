"use server";

import { refresh } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ROLE_HOME } from "@/components/app/shell/nav";
import { env } from "@/env";
import { ROLES } from "@/lib/roles";
import { auth } from "@/server/auth/auth";
import { getActor } from "@/server/auth/session";
import { signInAsSeedUser } from "@/server/auth/dev-preview";
import { BRANCH_COOKIE } from "@/server/session/shell";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
} as const;

/** Development only: sign in as the seeded account for a role. */
export async function previewAsRole(role: unknown) {
  const parsed = z.enum(ROLES).parse(role);
  await signInAsSeedUser(parsed, await headers());
  (await cookies()).delete(BRANCH_COOKIE);
  redirect(ROLE_HOME[parsed]);
}

/** Switch the active branch. Only branches the user belongs to are accepted. */
export async function selectBranch(branchId: unknown) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const parsed = z.string().parse(branchId);
  if (!actor.branchIds.includes(parsed)) throw new Error("You don't work at that branch.");
  (await cookies()).set(BRANCH_COOKIE, parsed, COOKIE_OPTIONS);
  refresh();
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  (await cookies()).delete(BRANCH_COOKIE);
  redirect("/login");
}
