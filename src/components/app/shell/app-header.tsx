"use client";

import { PanelLeft, Plus, Search } from "lucide-react";
import { usePathname } from "next/navigation";

import { useDialogs } from "@/components/app/dialogs/dialog-host";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Role } from "@/lib/roles";

import { SCREEN_TITLES, SCREENS_WITH_NEW_SESSION, screenFromPathname } from "./nav";
import { NotificationsMenu } from "./notifications-menu";
import { useShell } from "./shell-context";
import { ThemeToggle } from "./theme-toggle";
import { useModKeyLabel } from "./use-mod-key";

export function AppHeader({ branchName, role }: { branchName: string; role: Role }) {
  const { toggleSidebar, setCommandOpen } = useShell();
  const { openDialog } = useDialogs();
  const modKey = useModKeyLabel();
  const screen = screenFromPathname(usePathname());
  const showNewSession =
    role !== "therapist" && screen !== null && SCREENS_WITH_NEW_SESSION.includes(screen);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-3 md:px-4">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="-ml-1 text-muted-foreground"
            aria-label="Toggle sidebar"
            onClick={toggleSidebar}
          >
            <PanelLeft />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          Toggle sidebar <span className="ml-1 opacity-60">{modKey}B</span>
        </TooltipContent>
      </Tooltip>
      <Separator orientation="vertical" className="mr-1 h-4!" />
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="hidden truncate text-muted-foreground sm:inline">{branchName}</span>
        <span aria-hidden className="hidden text-muted-foreground/50 sm:inline">
          /
        </span>
        <span aria-current="page" className="truncate font-medium">
          {screen ? SCREEN_TITLES[screen] : ""}
        </span>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setCommandOpen(true)}
          className="hidden h-8 w-56 items-center gap-2 rounded-md border border-input bg-muted/40 px-2.5 text-sm text-muted-foreground shadow-xs transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:flex"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">Search patients…</span>
          <Kbd>{modKey}K</Kbd>
        </button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground lg:hidden"
          aria-label="Search"
          onClick={() => setCommandOpen(true)}
        >
          <Search />
        </Button>
        <ThemeToggle />
        <NotificationsMenu />
        {showNewSession && (
          <Button
            size="sm"
            onClick={() => openDialog({ kind: "booking" })}
            aria-label="New session"
          >
            <Plus /> <span className="hidden sm:inline">New session</span>
          </Button>
        )}
      </div>
    </header>
  );
}
