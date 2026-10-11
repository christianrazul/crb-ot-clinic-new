"use client";

import { Plus, Trash2 } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SettingsPageData } from "@/server/loaders/settings-page";

import {
  addSessionTypeAction,
  removeSessionTypeAction,
  updateSessionTypeRateAction,
} from "../actions";
import { AddForm, digitsOnly } from "./add-form";

/** Rate field that saves when it loses focus, not on every keystroke. */
function RateField({ id, name, rateCentavos }: { id: string; name: string; rateCentavos: number }) {
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
          const result = await updateSessionTypeRateAction(id, Number(value || 0));
          if (result.ok)
            toast.success(`${name} rate saved`, { description: "Applies to new bookings." });
          else toast.error(result.error);
        });
      }}
    />
  );
}

export function SessionTypesSection({ data }: { data: SettingsPageData }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [rate, setRate] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  return (
    <>
      <SectionHead
        title="Session types"
        description="Types offered at the desk and their default fee."
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
              const result = await addSessionTypeAction({
                name: trimmed,
                ratePesos: Number(rate || 0),
              });
              if (!result.ok) return void toast.error(result.error);
              setName("");
              setRate("");
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
        </AddForm>
        {data.sessionTypes.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session type</TableHead>
                <TableHead className="w-[160px]">Rate per session</TableHead>
                <TableHead className="w-[60px]">
                  <span className="sr-only">Remove</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.sessionTypes.map((type) => (
                <TableRow key={type.id}>
                  <TableCell>
                    <span className="flex items-center gap-2 font-medium">
                      <SvcDot service={type.service} />
                      {type.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <RateField
                      key={type.rateCentavos}
                      id={type.id}
                      name={type.name}
                      rateCentavos={type.rateCentavos}
                    />
                  </TableCell>
                  <TableCell className="text-right">
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
                              const result = await removeSessionTypeAction(type.id);
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
