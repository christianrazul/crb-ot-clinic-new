"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ROLE_HOME } from "@/components/app/shell/nav";
import { env } from "@/env";
import { BRANCHES } from "@/lib/fixtures/branches";
import { ROLES } from "@/lib/roles";
import { BRANCH_COOKIE, PREVIEW_ROLE_COOKIE } from "@/server/session/preview";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  secure: env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
} as const;

const roleInput = z.enum(ROLES);
const branchInput = z.string().refine((id) => BRANCHES.some((b) => b.id === id));

/** Development only: switch the previewed role and go to its home screen. */
export async function previewAsRole(role: unknown) {
  if (!env.NEXT_PUBLIC_DEV_ROLE_SWITCHER) {
    throw new Error("The role switcher is disabled.");
  }
  const parsed = roleInput.parse(role);
  (await cookies()).set(PREVIEW_ROLE_COOKIE, parsed, COOKIE_OPTIONS);
  redirect(ROLE_HOME[parsed]);
}

/** Switch the active branch. Milestone 4 adds a check that the user belongs to it. */
export async function selectBranch(branchId: unknown) {
  const parsed = branchInput.parse(branchId);
  (await cookies()).set(BRANCH_COOKIE, parsed, COOKIE_OPTIONS);
  refresh();
}
