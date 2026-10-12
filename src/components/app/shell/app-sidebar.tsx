"use client";

import {
  Check,
  ChevronsUpDown,
  Loader2,
  LogOut,
  Moon,
  PanelLeft,
  Plus,
  Sun,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import * as React from "react";

import { previewAsRole, selectBranch, signOut } from "@/app/(app)/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type BranchFixture, branchShortName, branchSubtitle } from "@/lib/fixtures/branches";
import type { UserFixture } from "@/lib/fixtures/users";
import { initialsOf } from "@/lib/initials";
import { ROLES, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";

import { LogoMark } from "./logo-mark";
import { NAV, screenFromPathname } from "./nav";
import { useShell } from "./shell-context";
import { useModKeyLabel } from "./use-mod-key";

const PREVIEW_LABELS: Record<Role, string> = {
  superadmin: "Admin",
  secretary: "Secretary",
  therapist: "Therapist",
};

type SidebarProps = {
  user: UserFixture;
  branch: BranchFixture;
  branches: BranchFixture[];
  showRoleSwitcher: boolean;
};

export function AppSidebar(props: SidebarProps) {
  const { collapsed, mobileNavOpen, setMobileNavOpen } = useShell();

  return (
    <>
      <aside
        aria-label="Main navigation"
        className={cn(
          "hidden shrink-0 bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:block",
          collapsed ? "w-14" : "w-64",
        )}
      >
        <SidebarContent {...props} collapsed={collapsed} mobile={false} />
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-72 gap-0 border-r-0 bg-sidebar p-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] shadow-xl sm:max-w-72 md:hidden"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Pages and account menu</SheetDescription>
          <SidebarContent {...props} collapsed={false} mobile />
        </SheetContent>
      </Sheet>
    </>
  );
}

function SidebarContent({
  user,
  branch,
  branches,
  showRoleSwitcher,
  collapsed,
  mobile,
}: SidebarProps & { collapsed: boolean; mobile: boolean }) {
  return (
    <div className={cn("flex h-full flex-col gap-2 p-2", collapsed && "items-center")}>
      <BranchSwitcher
        branch={branch}
        branches={branches}
        role={user.role}
        collapsed={collapsed}
        mobile={mobile}
      />
      <SidebarNav role={user.role} collapsed={collapsed} />
      {showRoleSwitcher && !collapsed && <RolePreview role={user.role} />}
      <UserMenu
        user={user}
        collapsed={collapsed}
        mobile={mobile}
        showRoleSwitcher={showRoleSwitcher}
      />
    </div>
  );
}

function BranchSwitcher({
  branch,
  branches,
  role,
  collapsed,
  mobile,
}: {
  branch: BranchFixture;
  branches: BranchFixture[];
  role: Role;
  collapsed: boolean;
  mobile: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [switchingTo, setSwitchingTo] = React.useState<string | null>(null);
  const target = branches.find((b) => b.id === switchingTo);

  return (
    <DropdownMenu open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
      <DropdownMenuTrigger asChild>
        <button
          aria-busy={pending}
          aria-label={collapsed ? `Switch branch, current: ${branch.name}` : undefined}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left ring-sidebar-ring transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-2 data-[state=open]:bg-sidebar-accent",
            collapsed && "w-auto justify-center",
          )}
        >
          <LogoMark />
          {!collapsed && (
            <>
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate text-sm font-semibold">CRB OT Clinic</span>
                <span className="truncate text-xs text-muted-foreground">
                  {pending && target
                    ? `Switching to ${branchShortName(target)}…`
                    : `${branchShortName(branch)} branch`}
                </span>
              </span>
              {pending ? (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              ) : (
                <ChevronsUpDown className="size-4 text-muted-foreground" />
              )}
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-60"
        align="start"
        side={mobile ? "bottom" : "right"}
        sideOffset={8}
      >
        <DropdownMenuLabel>Branches</DropdownMenuLabel>
        {branches.map((option) => (
          <DropdownMenuItem
            key={option.id}
            className="gap-2.5 py-2"
            disabled={pending}
            onSelect={(event) => {
              if (option.id === branch.id) return;
              event.preventDefault();
              setSwitchingTo(option.id);
              startTransition(async () => {
                await selectBranch(option.id);
                setOpen(false);
              });
            }}
          >
            <span className="flex size-7 items-center justify-center rounded-md border bg-background text-[11px] font-semibold text-foreground">
              {option.code}
            </span>
            <span className="grid flex-1 leading-tight">
              <span className="text-sm font-medium text-foreground">{option.name}</span>
              <span className="text-xs text-muted-foreground">{branchSubtitle(option)}</span>
            </span>
            {pending && option.id === switchingTo ? (
              <Loader2 className="animate-spin" aria-label="Switching" />
            ) : (
              option.id === branch.id && (
                <Check className="text-primary!" aria-label="Current branch" />
              )
            )}
          </DropdownMenuItem>
        ))}
        {role === "superadmin" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/settings">
                <Plus /> Add branch
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarNav({ role, collapsed }: { role: Role; collapsed: boolean }) {
  const pathname = usePathname();
  const current = screenFromPathname(pathname);
  const { setMobileNavOpen } = useShell();

  return (
    <nav
      className={cn("mt-2 flex flex-1 flex-col gap-4 overflow-y-auto", collapsed && "items-center")}
    >
      {NAV[role].map((section, index) => (
        <div
          key={section.heading || index}
          className={cn("flex flex-col gap-0.5", collapsed && "items-center")}
        >
          {section.heading && !collapsed && (
            <div className="px-2 pb-1 text-xs font-medium text-muted-foreground">
              {section.heading}
            </div>
          )}
          {section.heading && collapsed && <Separator className="mb-1 w-6" />}
          {section.items.map(({ key, label, href, icon: Icon }) => {
            const active = current === key;
            const link = (
              <Link
                href={href}
                onClick={() => setMobileNavOpen(false)}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? label : undefined}
                className={cn(
                  "group relative flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                  collapsed ? "w-8 justify-center px-0" : "w-full",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                )}
              >
                {active && !collapsed && (
                  <span className="absolute top-1.5 bottom-1.5 -left-2 w-[3px] rounded-r-full bg-primary" />
                )}
                <Icon
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0",
                    active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                {!collapsed && <span className="truncate">{label}</span>}
              </Link>
            );
            return collapsed ? (
              <Tooltip key={key}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            ) : (
              <React.Fragment key={key}>{link}</React.Fragment>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function RolePreview({ role }: { role: Role }) {
  const [pending, startTransition] = React.useTransition();

  return (
    <div className="rounded-lg border border-dashed border-sidebar-border p-2">
      <div id="preview-as-label" className="mb-1.5 px-0.5 text-xs text-muted-foreground">
        Preview as
      </div>
      <div
        role="group"
        aria-labelledby="preview-as-label"
        className="grid grid-cols-3 gap-0.5 rounded-md bg-muted p-0.5"
      >
        {ROLES.map((option) => (
          <button
            key={option}
            disabled={pending}
            aria-pressed={role === option}
            onClick={() => startTransition(() => previewAsRole(option))}
            className={cn(
              "rounded-[5px] px-1 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              role === option
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {PREVIEW_LABELS[option]}
          </button>
        ))}
      </div>
    </div>
  );
}

function UserMenu({
  user,
  collapsed,
  mobile,
  showRoleSwitcher,
}: {
  user: UserFixture;
  collapsed: boolean;
  mobile: boolean;
  showRoleSwitcher: boolean;
}) {
  const { toggleSidebar } = useShell();
  const { resolvedTheme, setTheme } = useTheme();
  const modKey = useModKeyLabel();
  const [, startTransition] = React.useTransition();
  const isDark = resolvedTheme === "dark";
  const initials = initialsOf(user.name);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={collapsed ? `Account menu for ${user.name}` : undefined}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors outline-none hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent",
            collapsed && "w-auto",
          )}
        >
          <Avatar className="size-8 rounded-lg">
            <AvatarFallback className="rounded-lg bg-accent text-accent-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate text-sm font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.title}</span>
              </span>
              <ChevronsUpDown className="size-4 text-muted-foreground" />
            </>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56"
        side={mobile ? "top" : "right"}
        align="end"
        sideOffset={8}
      >
        <DropdownMenuLabel className="flex items-center gap-2.5 py-2 text-foreground">
          <Avatar className="size-8 rounded-lg">
            <AvatarFallback className="rounded-lg bg-accent text-accent-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="grid leading-tight">
            <span className="text-sm font-medium">{user.name}</span>
            <span className="text-xs font-normal text-muted-foreground">{user.title}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {showRoleSwitcher && collapsed && (
          <>
            {ROLES.map((option) => (
              <DropdownMenuItem
                key={option}
                onSelect={() => startTransition(() => previewAsRole(option))}
              >
                <UserRound /> Preview as {PREVIEW_LABELS[option].toLowerCase()}
                {user.role === option && <Check className="ml-auto text-primary!" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onSelect={() => setTheme(isDark ? "light" : "dark")}>
          {isDark ? <Sun /> : <Moon />} {isDark ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        {!mobile && (
          <DropdownMenuItem onSelect={toggleSidebar}>
            <PanelLeft /> {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            <DropdownMenuShortcut>{modKey}B</DropdownMenuShortcut>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => startTransition(() => signOut())}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
