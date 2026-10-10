"use client";

import * as React from "react";

import { demoReducer, type DemoAction } from "@/lib/demo/reducer";
import { type DemoState, initialDemoState } from "@/lib/demo/state";
import type { BranchFixture } from "@/lib/fixtures/branches";
import type { UserFixture } from "@/lib/fixtures/users";
import type { Role } from "@/lib/roles";

/** Who is looking and where. Comes from the server session. */
export type Viewer = {
  user: UserFixture;
  role: Role;
  branchId: string;
  branchName: string;
  /** The staff record linked to the user, for therapists. */
  staffId: string | null;
};

type DemoStore = {
  state: DemoState;
  dispatch: React.Dispatch<DemoAction>;
  viewer: Viewer;
};

const DemoStoreContext = React.createContext<DemoStore | null>(null);

/**
 * Milestone 2 only: all screens read and change this in-memory copy of the
 * fixtures. It resets on reload. Later milestones move each slice to the
 * database and Server Actions.
 */
export function DemoStoreProvider({
  user,
  branch,
  children,
}: {
  user: UserFixture;
  branch: BranchFixture;
  children: React.ReactNode;
}) {
  const [state, dispatch] = React.useReducer(demoReducer, undefined, initialDemoState);

  const viewer = React.useMemo<Viewer>(
    () => ({
      user,
      role: user.role,
      branchId: branch.id,
      branchName: branch.name,
      staffId: state.staff.find((s) => s.userId === user.id)?.id ?? null,
    }),
    [user, branch, state.staff],
  );

  const value = React.useMemo(() => ({ state, dispatch, viewer }), [state, viewer]);
  return <DemoStoreContext.Provider value={value}>{children}</DemoStoreContext.Provider>;
}

export function useDemoStore(): DemoStore {
  const context = React.useContext(DemoStoreContext);
  if (!context) throw new Error("useDemoStore must be used inside <DemoStoreProvider>");
  return context;
}
