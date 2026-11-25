"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/detail-bits";
import { SectionHead } from "@/components/app/page-layout";
import { SvcDot } from "@/components/app/svc-dot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, InputGroup } from "@/components/ui/input";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { durationLabel, SESSION_DURATIONS } from "@/lib/booking";
import type { SettingsPageData } from "@/server/loaders/settings-page";

import {
  addSessionTypeAction,
  moveSessionTypeAction,
  removeSessionTypeAction,
  updateSessionTypeDurationAction,
  updateSessionTypeRateAction,
} from "../actions";
import { AddForm, digitsOnly } from "./add-form";

/** Rate field that saves when it loses focus, not on every keystroke. */
function RateField({
  branchId,
  id,
  name,
  rateCentavos,
}: {
  branchId: string;
  id: string;
  name: string;
  rateCentavos: number;
}) {
  const [value, setValue] = React.useState(String(rateCentavos / 100));
  const [, startTransition] = React.useTransition();
  return (
    <InputGroup
      prefix="₱"
      aria-label={`${name} rate`}
      value={value}
      inputMode="numeric"
      className="w-[120px]"
      inputClassName="h-8"
      onChange={(e) => setValue(digitsOnly(e.target.value))}
      onBlur={() => {
        if (Number(value || 0) * 100 === rateCentavos) return;
        startTransition(async () => {
          const result = await updateSessionTypeRateAction(branchId, id, Number(value || 0));
          if (result.ok)
            toast.success(`${name} rate saved`, { description: "Applies to new bookings." });
          else toast.error(result.error);
        });
      }}
    />
  );
}

/** Length picker: half an hour or one hour. */
function DurationSelect({
  id,
  value,
  onChange,
  disabled,
  label,
  className,
}: {
  id?: string;
  value: number;
  onChange: (minutes: number) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <Select
      value={String(value)}
      onValueChange={(next) => onChange(Number(next))}
      disabled={disabled}
    >
      <SelectTrigger id={id} aria-label={label} className={className}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SESSION_DURATIONS.map((minutes) => (
          <SelectItem key={minutes} value={String(minutes)}>
            {durationLabel(minutes)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function SessionTypesSection({ data }: { data: SettingsPageData }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [rate, setRate] = React.useState("");
  const [duration, setDuration] = React.useState(60);
  const [pending, startTransition] = React.useTransition();

  return (
    <>
      <SectionHead
        title="Session types"
        description={`Types the desk at ${data.branch.name} can book, and their default fee. The first type is preselected when booking.`}
      >
        {!open && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus /> Add session type
          </Button>
        )}
      </SectionHead>
      <Card className="overflow-hidden">
        <AddForm
          open={open}
          submitLabel="Add session type"
          onCancel={() => setOpen(false)}
          onSubmit={() =>
            startTransition(async () => {
              const trimmed = name.trim();
              const result = await addSessionTypeAction(data.branch.id, {
                name: trimmed,
                ratePesos: Number(rate || 0),
                durationMinutes: duration,
              });
              if (!result.ok) return void toast.error(result.error);
              setName("");
              setRate("");
              setDuration(60);
              setOpen(false);
              toast.success(`${trimmed} added`);
            })
          }
        >
          <div className="grid min-w-[200px] flex-1 gap-1.5">
            <Label htmlFor="st-name">Name</Label>
            <Input
              id="st-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. OT group session"
            />
          </div>
          <div className="grid w-[140px] gap-1.5">
            <Label htmlFor="st-rate">Rate</Label>
            <InputGroup
              id="st-rate"
              prefix="₱"
              value={rate}
              onChange={(e) => setRate(digitsOnly(e.target.value))}
              placeholder="700"
              inputMode="numeric"
            />
          </div>
          <div className="grid w-[140px] gap-1.5">
            <Label htmlFor="st-duration">Time interval</Label>
            <DurationSelect id="st-duration" value={duration} onChange={setDuration} />
          </div>
        </AddForm>
        {data.sessionTypes.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session type</TableHead>
                <TableHead className="w-[160px]">Time interval</TableHead>
                <TableHead className="w-[160px]">Rate per session</TableHead>
                <TableHead className="w-[100px]">
                  <span className="sr-only">Order and remove</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.sessionTypes.map((type, index) => (
                <TableRow key={type.id}>
                  <TableCell>
                    <span className="flex items-center gap-2 font-medium">
                      <SvcDot service={type.service} />
                      {type.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <DurationSelect
                      label={`${type.name} time interval`}
                      value={type.durationMinutes}
                      disabled={pending}
                      className="h-8 w-[120px]"
                      onChange={(minutes) =>
                        startTransition(async () => {
                          const result = await updateSessionTypeDurationAction(
                            data.branch.id,
                            type.id,
                            minutes,
                          );
                          if (result.ok)
                            toast.success(`${type.name} is now ${durationLabel(minutes)}`, {
                              description: "Applies to new bookings.",
                            });
                          else toast.error(result.error);
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <RateField
                      key={type.rateCentavos}
                      branchId={data.branch.id}
                      id={type.id}
                      name={type.name}
                      rateCentavos={type.rateCentavos}
                    />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {(["up", "down"] as const).map((direction) => {
                      const Icon = direction === "up" ? ArrowUp : ArrowDown;
                      const edge =
                        direction === "up" ? index === 0 : index === data.sessionTypes.length - 1;
                      return (
                        <Button
                          key={direction}
                          variant="ghost"
                          size="icon-sm"
                          disabled={pending || edge}
                          className="text-muted-foreground"
                          aria-label={`Move ${type.name} ${direction}`}
                          onClick={() =>
                            startTransition(async () => {
                              const result = await moveSessionTypeAction(
                                data.branch.id,
                                type.id,
                                direction,
                              );
                              if (!result.ok) toast.error(result.error);
                            })
                          }
                        >
                          <Icon />
                        </Button>
                      );
                    })}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          disabled={pending}
                          className="text-muted-foreground hover:bg-danger-soft hover:text-danger"
                          aria-label={`Remove ${type.name}`}
                          onClick={() =>
                            startTransition(async () => {
                              const result = await removeSessionTypeAction(data.branch.id, type.id);
                              if (result.ok)
                                toast.success(`${type.name} removed`, {
                                  description: "Past sessions of this type keep it.",
                                });
                              else toast.error(result.error);
                            })
                          }
                        >
                          <Trash2 />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Remove</TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No session types"
            description="Add one so the desk can book sessions."
          />
        )}
      </Card>
    </>
  );
}
