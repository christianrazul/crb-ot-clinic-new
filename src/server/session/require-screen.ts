import "server-only";

import { redirect } from "next/navigation";

import { canSeeScreen, ROLE_HOME, type ScreenKey } from "@/components/app/shell/nav";

import { getShellSession } from "./preview";

/**
 * Sends roles without the screen in their navigation back to their home.
 * A UI convenience until Milestone 4; it is not an authorization check.
 */
export async function requireScreen(screen: ScreenKey) {
  const session = await getShellSession();
  if (!canSeeScreen(session.user.role, screen)) redirect(ROLE_HOME[session.user.role]);
  return session;
}
