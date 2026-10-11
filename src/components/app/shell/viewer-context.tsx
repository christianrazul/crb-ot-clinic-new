"use client";

import * as React from "react";

import type { BranchFixture } from "@/lib/fixtures/branches";
import type { UserFixture } from "@/lib/fixtures/users";
import type { Role } from "@/lib/roles";

/**
 * Who is looking and where, from the server session. For choosing what to
 * show only; every Server Action checks permissions again on the server.
 */
export type Viewer = {
  user: UserFixture;
  role: Role;
  branchId: string;
  branchName: string;
};

const ViewerContext = React.createContext<Viewer | null>(null);

export function ViewerProvider({
  user,
  branch,
  children,
}: {
  user: UserFixture;
  branch: BranchFixture;
  children: React.ReactNode;
}) {
  const value = React.useMemo<Viewer>(
    () => ({ user, role: user.role, branchId: branch.id, branchName: branch.name }),
    [user, branch],
  );
  return <ViewerContext.Provider value={value}>{children}</ViewerContext.Provider>;
}

export function useViewer(): Viewer {
  const viewer = React.useContext(ViewerContext);
  if (!viewer) throw new Error("useViewer must be used inside the app shell.");
  return viewer;
}
