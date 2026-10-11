"use client";

import { KeyRound, MailPlus, MoreHorizontal, Pencil, Power, UserPlus } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { SectionHead } from "@/components/app/page-layout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatManila } from "@/lib/dates";
import { initialsOf } from "@/lib/initials";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { cn } from "@/lib/utils";
import type { InviteResult } from "@/server/auth/invites";
import type { SettingsPageData } from "@/server/loaders/settings-page";
import type { TeamStatus } from "@/server/services/users";

import {
  addAccountAction,
  resendInviteAction,
  setAccountActiveAction,
  updateAccountAction,
} from "../actions";

type Account = SettingsPageData["team"]["accounts"][number];

const STATUS: Record<
  TeamStatus,
  { label: string; variant: "success" | "warning" | "muted" | "danger" }
> = {
  active: { label: "Active", variant: "success" },
  invited: { label: "Invited", variant: "warning" },
  locked: { label: "Locked", variant: "danger" },
  turned_off: { label: "Turned off", variant: "muted" },
};

/** What each kind of account can do, shown when choosing one. */
const ACCESS_HELP: Record<Role, string> = {
  secretary:
    "Today's queue, the schedule, patients, check-in, billing and advance payments at their branches. No payroll, dashboard or settings.",
  superadmin: "Everything, including payroll, the dashboard, settings and these accounts.",
  therapist: "Their own patients, sessions and notes only.",
};

function inviteToast(name: string, email: string, invite: InviteResult) {
  if (invite.sent) {
    toast.success(`Invite sent to ${name}`, {
      description: `${email} gets a link to set a password. It works for 3 days.`,
    });
  } else if (invite.reason === "limited") {
    toast.warning("Too many invites to this person in the last hour", {
      description: "Try again later, or ask them to use Forgot password on the login page.",
    });
  } else {
    toast.error(`The invite to ${email} didn't go out`, {
      description: "Check the email settings on the server, then use Resend invite.",
    });
  }
}

export function TeamSection({ data }: { data: SettingsPageData }) {
  const { accounts, staffWithoutLogin } = data.team;
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Account | null>(null);
  const [pending, startTransition] = React.useTransition();

  const run = (work: () => Promise<void>) => startTransition(work);

  return (
    <>
      <SectionHead
        title="Team accounts"
        description="Who can sign in, what they can do, and whether they've set their password yet."
      >
        <Button size="sm" onClick={() => setAdding(true)}>
          <UserPlus /> Add account
        </Button>
      </SectionHead>
      <Card className={cn("overflow-hidden", pending && "opacity-70")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Branches</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((account) => {
              const status = STATUS[account.status];
              return (
                <TableRow key={account.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-7" aria-hidden>
                        <AvatarFallback className="bg-accent text-[10px] text-accent-foreground">
                          {initialsOf(account.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="grid min-w-0 leading-tight">
                        <span className="font-medium whitespace-nowrap">
                          {account.name}
                          {account.isYou && (
                            <span className="font-normal text-muted-foreground"> (you)</span>
                          )}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {account.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {ROLE_LABELS[account.role as Role]}
                    {account.staff && (
                      <div className="text-xs text-muted-foreground">{account.staff.name}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {account.branches.map((b) => b.name).join(", ")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                    <div className="mt-1 text-xs whitespace-nowrap text-muted-foreground">
                      {account.lastSignInAt
                        ? `Last signed in ${formatManila(new Date(account.lastSignInAt), "date")}`
                        : account.status === "invited"
                          ? "Hasn't set a password yet"
                          : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground"
                          aria-label={`Actions for ${account.name}`}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        {account.status !== "turned_off" && (
                          <DropdownMenuItem
                            onSelect={() =>
                              run(async () => {
                                const result = await resendInviteAction(account.id);
                                if (!result.ok) return void toast.error(result.error);
                                inviteToast(account.name, account.email, result.data.invite);
                              })
                            }
                          >
                            <MailPlus />
                            {account.status === "invited" ? "Resend invite" : "Send password link"}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onSelect={() => setEditing(account)}>
                          <Pencil /> Change access
                        </DropdownMenuItem>
                        {!account.isYou && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className={cn(
                                account.status !== "turned_off" && "text-danger focus:text-danger",
                              )}
                              onSelect={() =>
                                run(async () => {
                                  const on = account.status === "turned_off";
                                  const result = await setAccountActiveAction(account.id, on);
                                  if (!result.ok) return void toast.error(result.error);
                                  toast.success(
                                    on
                                      ? `${account.name} can sign in again`
                                      : `${account.name} is signed out and can't sign in`,
                                    on
                                      ? undefined
                                      : { description: "Their history stays on record." },
                                  );
                                })
                              }
                            >
                              <Power />
                              {account.status === "turned_off" ? "Turn on" : "Turn off"}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <KeyRound className="size-3.5" aria-hidden />
        Nobody chooses a password for anyone: each person sets their own from the invite email.
      </p>

      {adding && (
        <AccountDialog
          key="add"
          data={data}
          staffWithoutLogin={staffWithoutLogin}
          onClose={() => setAdding(false)}
        />
      )}
      {editing && (
        <AccountDialog
          key={editing.id}
          data={data}
          staffWithoutLogin={staffWithoutLogin}
          existing={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}

type AccessChoice = "secretary" | "superadmin" | `staff:${string}`;

function AccountDialog({
  data,
  staffWithoutLogin,
  existing,
  onClose,
}: {
  data: SettingsPageData;
  staffWithoutLogin: SettingsPageData["team"]["staffWithoutLogin"];
  existing?: Account;
  onClose: () => void;
}) {
  const [name, setName] = React.useState(existing?.name ?? "");
  const [email, setEmail] = React.useState(existing?.email ?? "");
  const [access, setAccess] = React.useState<AccessChoice>(() => {
    if (!existing) return "secretary";
    if (existing.role === "therapist") return `staff:${existing.staff?.id ?? ""}`;
    return existing.role === "superadmin" ? "superadmin" : "secretary";
  });
  const [branchIds, setBranchIds] = React.useState<string[]>(
    existing?.branches.map((b) => b.id) ?? [data.branch.id],
  );
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const staffId = access.startsWith("staff:") ? access.slice(6) : null;
  const role: Role = staffId !== null ? "therapist" : (access as Role);
  const linkedStaff = staffWithoutLogin.find((s) => s.id === staffId);
  const lockedToTherapist = existing?.role === "therapist";
  const roleLocked = existing?.isYou || lockedToTherapist;

  const pickStaff = (value: AccessChoice) => {
    setAccess(value);
    const member = staffWithoutLogin.find((s) => `staff:${s.id}` === value);
    if (member && !existing) {
      setName(member.displayName.split(",")[0]!.trim());
      setBranchIds((ids) => (ids.includes(member.branchId) ? ids : [...ids, member.branchId]));
    }
  };

  const submit = () =>
    startTransition(async () => {
      setError(null);
      if (existing) {
        const result = await updateAccountAction({ userId: existing.id, role, branchIds });
        if (!result.ok) return setError(result.error);
        toast.success(`${existing.name}'s access updated`, {
          description:
            role !== existing.role ? "They were signed out to pick up the change." : undefined,
        });
        return onClose();
      }
      const result = await addAccountAction({
        name: name.trim(),
        email: email.trim(),
        role,
        branchIds,
        ...(staffId ? { staffId } : {}),
      });
      if (!result.ok) return setError(result.error);
      inviteToast(name.trim(), email.trim(), result.data.invite);
      onClose();
    });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {existing ? `Change ${existing.name}'s access` : "Add an account"}
          </DialogTitle>
          <DialogDescription>
            {existing
              ? "Changing what someone can do signs them out once."
              : "They get an email with a link to set their own password."}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="acct-access">Access</Label>
            <Select
              value={access}
              onValueChange={(value) => pickStaff(value as AccessChoice)}
              disabled={roleLocked}
            >
              <SelectTrigger id="acct-access">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="secretary">Front desk (secretary)</SelectItem>
                <SelectItem value="superadmin">Clinic owner</SelectItem>
                {lockedToTherapist && existing?.staff && (
                  <SelectItem value={`staff:${existing.staff.id}`}>
                    Therapist: {existing.staff.name}
                  </SelectItem>
                )}
                {!existing &&
                  staffWithoutLogin.map((s) => (
                    <SelectItem key={s.id} value={`staff:${s.id}`}>
                      Therapist login for {s.displayName}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{ACCESS_HELP[role]}</p>
            {existing?.isYou && (
              <p className="text-xs text-muted-foreground">
                You can&apos;t change your own access.
              </p>
            )}
            {!existing && !staffWithoutLogin.length && (
              <p className="text-xs text-muted-foreground">
                For a therapist, add them under Staff with a login email.
              </p>
            )}
          </div>
          {!existing && (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="acct-name">Full name</Label>
                <Input
                  id="acct-name"
                  value={name}
                  autoComplete="off"
                  onChange={(e) => setName(e.target.value)}
                  placeholder={linkedStaff ? undefined : "e.g. Jo Lauron"}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="acct-email">Email</Label>
                <Input
                  id="acct-email"
                  type="email"
                  value={email}
                  autoComplete="off"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="They sign in with this"
                />
              </div>
            </>
          )}
          <fieldset className="grid gap-2">
            <legend className="mb-1.5 text-sm font-medium">Branches</legend>
            {data.branches.map((branch) => {
              const checked = branchIds.includes(branch.id);
              return (
                <label key={branch.id} className="flex items-center gap-2.5 text-sm">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(next) =>
                      setBranchIds((ids) =>
                        next ? [...ids, branch.id] : ids.filter((id) => id !== branch.id),
                      )
                    }
                  />
                  {branch.name}
                </label>
              );
            })}
          </fieldset>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger-soft/60 px-3 py-2 text-sm text-danger-strong"
            >
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={
              pending ||
              !branchIds.length ||
              (!existing && (!name.trim() || !email.trim() || access === "staff:"))
            }
          >
            {existing ? "Save access" : "Send invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
