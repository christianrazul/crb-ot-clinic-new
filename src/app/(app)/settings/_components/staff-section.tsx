"use client";

import { MoreHorizontal, UserPlus, UserX } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { SectionHead } from "@/components/app/page-layout";
import { SvcDot } from "@/components/app/svc-dot";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { initialsOf } from "@/lib/initials";
import { SERVICE_SOFT } from "@/lib/services";
import { cn } from "@/lib/utils";
import type { SettingsPageData } from "@/server/loaders/settings-page";

import { addStaffAction, setStaffActiveAction } from "../actions";
import { AddForm } from "./add-form";

/** Below this, a therapist's month has room for more sessions. */
const LOW_UTILIZATION_PCT = 70;

export function StaffSection({ data }: { data: SettingsPageData }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [rateClassId, setRateClassId] = React.useState(data.rateClasses[0]?.id ?? "");
  const [pending, startTransition] = React.useTransition();

  return (
    <>
      <SectionHead
        title="Staff"
        description="Therapists, aides and tutors, with their load this month."
      >
        {!open && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <UserPlus /> Add staff member
          </Button>
        )}
      </SectionHead>
      <Card className={cn("overflow-hidden", pending && "opacity-70")}>
        <AddForm
          open={open}
          submitLabel="Add staff member"
          onCancel={() => setOpen(false)}
          onSubmit={() =>
            startTransition(async () => {
              const trimmed = name.trim();
              const result = await addStaffAction({
                displayName: trimmed,
                rateClassId,
                loginEmail: email.trim(),
              });
              if (!result.ok) return void toast.error(result.error);
              setName("");
              setEmail("");
              setOpen(false);
              const invite = result.data.invite;
              if (invite && !invite.sent) {
                toast.warning(`${trimmed} added, but the invite email didn't go out`, {
                  description: "Resend it from Settings → Team accounts.",
                });
              } else {
                toast.success(`${trimmed} added to staff`, {
                  description: invite
                    ? `We emailed ${email.trim()} an invite to set a password.`
                    : undefined,
                });
              }
            })
          }
        >
          <div className="grid min-w-[200px] flex-1 gap-1.5">
            <Label htmlFor="sf-name">Full name</Label>
            <Input
              id="sf-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rita Cruz, OTRP"
            />
          </div>
          <div className="grid w-[230px] gap-1.5">
            <Label htmlFor="sf-role">Role</Label>
            <Select value={rateClassId} onValueChange={setRateClassId}>
              <SelectTrigger id="sf-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.rateClasses.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    <span className="flex items-center gap-2">
                      <SvcDot service={r.service} />
                      {r.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid min-w-[200px] flex-1 gap-1.5">
            <Label htmlFor="sf-email">
              Login email <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="sf-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Gives them My day"
            />
          </div>
        </AddForm>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Sessions</TableHead>
              <TableHead className="text-right">Patients</TableHead>
              <TableHead className="w-[160px]">Utilization</TableHead>
              <TableHead className="w-[50px]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.staff.map((member) => {
              const low =
                member.utilizationPct !== null && member.utilizationPct < LOW_UTILIZATION_PCT;
              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-7" aria-hidden>
                        <AvatarFallback
                          className={cn("text-[10px]", SERVICE_SOFT[member.rateClass.service])}
                        >
                          {initialsOf(member.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium whitespace-nowrap">{member.displayName}</span>
                      {member.userId && <Badge variant="muted">Login</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      <SvcDot service={member.rateClass.service} />
                      {member.rateClass.shortName}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.active ? "success" : "muted"}>
                      {member.active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{member.monthSessions}</TableCell>
                  <TableCell className="text-right">{member.monthPatients}</TableCell>
                  <TableCell>
                    {member.utilizationPct === null ? (
                      <span className="text-xs text-muted-foreground">No sessions yet</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Progress
                          value={Math.min(100, member.utilizationPct)}
                          aria-label={`${member.displayName} utilization`}
                          className="h-1.5 flex-1"
                          indicatorClassName={low ? "bg-warning" : "bg-success"}
                        />
                        <span
                          className={cn(
                            "w-9 text-right text-xs font-medium tabular-nums",
                            low && "text-warning-strong",
                          )}
                        >
                          {member.utilizationPct}%
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground"
                          aria-label={`Actions for ${member.displayName}`}
                        >
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onSelect={() =>
                            startTransition(async () => {
                              const result = await setStaffActiveAction(member.id, !member.active);
                              if (result.ok)
                                toast.success(
                                  `${member.displayName} set ${member.active ? "inactive" : "active"}`,
                                );
                              else toast.error(result.error);
                            })
                          }
                        >
                          <UserX /> {member.active ? "Set inactive" : "Set active"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
