"use client";

import type * as React from "react";

import { DemoStoreProvider } from "@/components/app/demo/demo-store";
import { DialogHost } from "@/components/app/dialogs/dialog-host";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { BranchFixture } from "@/lib/fixtures/branches";
import type { UserFixture } from "@/lib/fixtures/users";

import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { CommandMenu } from "./command-menu";
import { ShellProvider } from "./shell-context";

type AppShellProps = {
  user: UserFixture;
  branch: BranchFixture;
  branches: BranchFixture[];
  sidebarCollapsed: boolean;
  showRoleSwitcher: boolean;
  /** Clinic date (yyyy-MM-dd) from the server clock, for dialog defaults. */
  today: string;
  children: React.ReactNode;
};

/**
 * Inset layout: tinted sidebar, white content panel with an 8px gap on desktop.
 * Only the content panel scrolls; the page itself never scrolls horizontally.
 */
export function AppShell({
  user,
  branch,
  branches,
  sidebarCollapsed,
  showRoleSwitcher,
  today,
  children,
}: AppShellProps) {
  return (
    <ShellProvider defaultCollapsed={sidebarCollapsed}>
      <TooltipProvider delayDuration={200}>
        <DemoStoreProvider user={user} branch={branch}>
          <DialogHost today={today}>
            <div className="flex h-dvh w-full overflow-hidden bg-sidebar pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
              <AppSidebar
                user={user}
                branch={branch}
                branches={branches}
                showRoleSwitcher={showRoleSwitcher}
              />
              <div className="flex min-w-0 flex-1 flex-col md:py-2 md:pr-2">
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background md:rounded-xl md:border md:shadow-xs">
                  <AppHeader branchName={branch.name} role={user.role} />
                  <main id="main" className="min-h-0 flex-1 overflow-y-auto">
                    {children}
                  </main>
                </div>
              </div>
            </div>
            <CommandMenu />
          </DialogHost>
        </DemoStoreProvider>
      </TooltipProvider>
    </ShellProvider>
  );
}
