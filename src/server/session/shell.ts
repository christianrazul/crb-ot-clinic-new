import "server-only";

import { cookies } from "next/headers";

import { requireActor } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { listBranches } from "@/server/db/queries/branches";
import type { Actor } from "@/server/auth/actor";
import type { BranchFixture } from "@/lib/fixtures/branches";
import type { UserFixture } from "@/lib/fixtures/users";

export const BRANCH_COOKIE = "crb-branch";
export const SIDEBAR_COOKIE = "crb-sidebar";

export type ShellSession = {
  actor: Actor;
  user: UserFixture;
  branch: BranchFixture;
  branches: BranchFixture[];
  sidebarCollapsed: boolean;
};

/**
 * Everything the app shell needs for this request. The active branch comes
 * from a cookie but is only honoured if the user belongs to that branch.
 */
export async function getShellSession(): Promise<ShellSession> {
  const actor = await requireActor();
  const store = await cookies();
  const all = await listBranches(getDb());
  const branches = all
    .filter((b) => actor.branchIds.includes(b.id))
    .map((b) => ({ id: b.id, code: b.code, name: b.name, location: b.location, isMain: b.isMain }));
  if (!branches.length) throw new Error(`${actor.email} has no branch. Add one in settings.`);

  const wanted = store.get(BRANCH_COOKIE)?.value;
  const branch =
    branches.find((b) => b.id === wanted) ?? branches.find((b) => b.isMain) ?? branches[0]!;

  return {
    actor,
    user: { id: actor.userId, name: actor.name, title: actor.title, role: actor.role },
    branch,
    branches,
    sidebarCollapsed: store.get(SIDEBAR_COOKIE)?.value === "collapsed",
  };
}

/** The branch the actor is working in, for services that need one. */
export async function currentBranchId(): Promise<string> {
  return (await getShellSession()).branch.id;
}
