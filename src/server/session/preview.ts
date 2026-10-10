import "server-only";

import { cookies } from "next/headers";

import { BRANCHES, type BranchFixture } from "@/lib/fixtures/branches";
import { USERS, type UserFixture } from "@/lib/fixtures/users";
import { isRole } from "@/lib/roles";

/**
 * Temporary stand-in for a real session until Better Auth lands in Milestone 4.
 * The previewed role and the selected branch live in cookies so the server
 * renders the right shell on the first paint.
 */
export const PREVIEW_ROLE_COOKIE = "crb-preview-role";
export const BRANCH_COOKIE = "crb-branch";
export const SIDEBAR_COOKIE = "crb-sidebar";

export type ShellSession = {
  user: UserFixture;
  branch: BranchFixture;
  branches: BranchFixture[];
  sidebarCollapsed: boolean;
};

export async function getShellSession(): Promise<ShellSession> {
  const store = await cookies();

  const roleValue = store.get(PREVIEW_ROLE_COOKIE)?.value;
  const role = isRole(roleValue) ? roleValue : "superadmin";

  const branchId = store.get(BRANCH_COOKIE)?.value;
  const branch = BRANCHES.find((b) => b.id === branchId) ?? BRANCHES[0]!;

  return {
    user: USERS[role],
    branch,
    branches: BRANCHES,
    sidebarCollapsed: store.get(SIDEBAR_COOKIE)?.value === "collapsed",
  };
}
