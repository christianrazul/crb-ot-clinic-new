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
import { SERVICE_LABELS, type ServiceKey } from "@/lib/services";
import { cn } from "@/lib/utils";
import type { SettingsPageData } from "@/server/loaders/settings-page";

import {
  addSessionTypeAction,
  moveSessionTypeAction,
  removeSessionTypeAction,
  saveSessionTypesAction,
} from "../actions";
import { AddForm, digitsOnly } from "./add-form";

type SessionType = SettingsPageData["sessionTypes"][number];
type Service = SessionType["service"];

/** What the table edits for one type. Rate is kept as typed so the field can be empty. */
type RowDraft = { name: string; service: Service; rate: string; durationMinutes: number };

const fromType = (type: SessionType): RowDraft => ({
  name: type.name,
  service: type.service,
  rate: String(type.rateCentavos / 100),
  durationMinutes: type.durationMinutes,
});

const isChanged = (type: SessionType, row: RowDraft) =>
  row.name.trim() !== type.name ||
  row.service !== type.service ||
  Number(row.rate || 0) * 100 !== type.rateCentavos ||
  row.durationMinutes !== type.durationMinutes;

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

const COLOR_CHOICES = ["ot", "speech", "sped", "none"] as const satisfies ServiceKey[];

/** A type's color is its service: OT, Speech, SPED or uncategorized. */
function ColorSelect({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: Service;
  onChange: (service: Service) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value ?? "none"}
      disabled={disabled}
      onValueChange={(next) => onChange(next === "none" ? null : (next as NonNullable<Service>))}
    >
      <SelectTrigger aria-label={label} title="Color (service)" className="h-8 w-auto gap-1.5 px-2">
        <SvcDot service={value} className="size-3" />
      </SelectTrigger>
      <SelectContent>
        {COLOR_CHOICES.map((key) => (
          <SelectItem key={key} value={key}>
            <span className="flex items-center gap-2">
              <SvcDot service={key} className="size-3" />
              {SERVICE_LABELS[key]}
            </span>
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
  const [saving, startSaving] = React.useTransition();
  // Unsaved edits by type id. Rows without an entry show what is saved, so
  // adding, moving or removing a type never loses or resurrects an edit.
  const [edits, setEdits] = React.useState<Record<string, RowDraft>>({});

  const rowFor = (type: SessionType) => edits[type.id] ?? fromType(type);
  const edit = (type: SessionType, patch: Partial<RowDraft>) =>
    setEdits((current) => ({ ...current, [type.id]: { ...rowFor(type), ...patch } }));

  const changed = data.sessionTypes.filter((type) => {
    const row = edits[type.id];
    return row && isChanged(type, row);
  });
  const dirty = changed.length > 0;
  const invalid = changed.some((type) => edits[type.id]!.name.trim().length < 2);
  const busy = pending || saving;

  // Warn before leaving the page with edits that were never saved.
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = () =>
    startSaving(async () => {
      const result = await saveSessionTypesAction(
        data.branch.id,
        changed.map((type) => {
          const row = edits[type.id]!;
          return {
            id: type.id,
            name: row.name.trim(),
            service: row.service,
            ratePesos: Number(row.rate || 0),
            durationMinutes: row.durationMinutes,
          };
        }),
      );
      if (!result.ok) return void toast.error(result.error);
      setEdits({});
      toast.success(
        changed.length === 1
          ? `${edits[changed[0]!.id]!.name.trim()} saved`
          : `${changed.length} session types saved`,
        { description: "Fees and time intervals apply to new bookings." },
      );
    });

  return (
    <>
      <SectionHead
        title="Session types"
        description={`Types the desk at ${data.branch.name} can book, and their default fee. The first type is preselected when booking.`}
      >
        <div className="flex flex-wrap items-center gap-2">
          {!open && (
            <Button size="sm" variant="outline" onClick={() => setOpen(true)} disabled={saving}>
              <Plus /> Add session type
            </Button>
          )}
          {dirty && (
            <Button size="sm" variant="ghost" onClick={() => setEdits({})} disabled={saving}>
              Discard
            </Button>
          )}
          <Button
            size="sm"
            onClick={save}
            loading={saving}
            disabled={!dirty || invalid || pending}
            title={invalid ? "Every session type needs a name." : undefined}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
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
          <Table className={cn(saving && "opacity-70")}>
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
              {data.sessionTypes.map((type, index) => {
                const row = rowFor(type);
                const rowChanged = isChanged(type, row);
                const nameMissing = row.name.trim().length < 2;
                return (
                  <TableRow key={type.id} className={cn(rowChanged && "bg-muted/40")}>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <ColorSelect
                          label={`${type.name} color`}
                          value={row.service}
                          disabled={saving}
                          onChange={(service) => edit(type, { service })}
                        />
                        <Input
                          aria-label={`${type.name} name`}
                          aria-invalid={nameMissing || undefined}
                          value={row.name}
                          maxLength={60}
                          disabled={saving}
                          className="h-8 min-w-[160px] font-medium"
                          onChange={(e) => edit(type, { name: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && dirty && !invalid) save();
                          }}
                        />
                      </span>
                    </TableCell>
                    <TableCell>
                      <DurationSelect
                        label={`${type.name} time interval`}
                        value={row.durationMinutes}
                        disabled={saving}
                        className="h-8 w-[120px]"
                        onChange={(durationMinutes) => edit(type, { durationMinutes })}
                      />
                    </TableCell>
                    <TableCell>
                      <InputGroup
                        prefix="₱"
                        aria-label={`${type.name} rate`}
                        value={row.rate}
                        inputMode="numeric"
                        disabled={saving}
                        className="w-[120px]"
                        inputClassName="h-8"
                        onChange={(e) => edit(type, { rate: digitsOnly(e.target.value) })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && dirty && !invalid) save();
                        }}
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
                            disabled={busy || edge}
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
                            disabled={busy}
                            className="text-muted-foreground hover:bg-danger-soft hover:text-danger"
                            aria-label={`Remove ${type.name}`}
                            onClick={() =>
                              startTransition(async () => {
                                const result = await removeSessionTypeAction(
                                  data.branch.id,
                                  type.id,
                                );
                                if (!result.ok) return void toast.error(result.error);
                                setEdits(({ [type.id]: _, ...rest }) => rest);
                                toast.success(`${type.name} removed`, {
                                  description: "Past sessions of this type keep it.",
                                });
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
                );
              })}
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
