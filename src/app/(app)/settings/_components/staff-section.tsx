"use client";

import { MoreHorizontal, Pencil, UserPlus, UserX } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { useDemoStore } from "@/components/app/demo/demo-store";
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
import { byId } from "@/lib/demo/selectors";
import { initialsOf } from "@/lib/initials";
import { SERVICE_SOFT } from "@/lib/services";
import { cn } from "@/lib/utils";

import { AddForm } from "./add-form";

/** Below this, a therapist's week has room for more sessions. */
const LOW_UTILIZATION_PCT = 70;

export function StaffSection() {
  const { state, dispatch } = useDemoStore();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [rateClassId, setRateClassId] = React.useState(state.rateClasses[0]!.id);

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
      <Card className="overflow-hidden">
        <AddForm
          open={open}
          submitLabel="Add staff member"
          onCancel={() => setOpen(false)}
          onSubmit={() => {
            const trimmed = name.trim();
            if (!trimmed) return;
            dispatch({ type: "staff/add", displayName: trimmed, rateClassId });
            setName("");
            setOpen(false);
            toast.success(`${trimmed} added to staff`);
          }}
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
                {state.rateClasses.map((r) => (
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
            {state.staff.map((member) => {
              const rateClass = byId(state.rateClasses, member.rateClassId);
              const service = rateClass?.service ?? "none";
              const low =
                member.utilizationPct !== null && member.utilizationPct < LOW_UTILIZATION_PCT;
              return (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-7" aria-hidden>
                        <AvatarFallback className={cn("text-[10px]", SERVICE_SOFT[service])}>
                          {initialsOf(member.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium whitespace-nowrap">{member.displayName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      <SvcDot service={service} />
                      {rateClass?.shortName}
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
                          value={member.utilizationPct}
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
                            toast.info("Editing staff is not built yet", {
                              description: "It arrives in Milestone 6.",
                            })
                          }
                        >
                          <Pencil /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() => {
                            dispatch({
                              type: "staff/setActive",
                              id: member.id,
                              active: !member.active,
                            });
                            toast.success(
                              `${member.displayName} set ${member.active ? "inactive" : "active"}`,
                            );
                          }}
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
