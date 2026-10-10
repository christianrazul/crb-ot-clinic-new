"use client";

import { Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { useDemoStore } from "@/components/app/demo/demo-store";
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

import { AddForm, digitsOnly } from "./add-form";

export function SessionTypesSection() {
  const { state, dispatch } = useDemoStore();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [rate, setRate] = React.useState("");
  const types = state.sessionTypes.filter((t) => t.active);

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
          onSubmit={() => {
            const trimmed = name.trim();
            if (!trimmed) return;
            dispatch({
              type: "sessionType/add",
              name: trimmed,
              rateCentavos: Number(rate || 0) * 100,
            });
            setName("");
            setRate("");
            setOpen(false);
            toast.success(`${trimmed} added`);
          }}
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
        {types.length ? (
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
              {types.map((type) => (
                <TableRow key={type.id}>
                  <TableCell>
                    <span className="flex items-center gap-2 font-medium">
                      <SvcDot service={type.service} />
                      {type.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <InputGroup
                      prefix="₱"
                      aria-label={`${type.name} rate`}
                      value={String(type.rateCentavos / 100)}
                      inputMode="numeric"
                      className="w-[120px]"
                      inputClassName="h-8"
                      onChange={(e) =>
                        dispatch({
                          type: "sessionType/update",
                          id: type.id,
                          rateCentavos: Number(digitsOnly(e.target.value) || 0) * 100,
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:bg-danger-soft hover:text-danger"
                          aria-label={`Remove ${type.name}`}
                          onClick={() => {
                            dispatch({ type: "sessionType/remove", id: type.id });
                            toast.success(`${type.name} removed`, {
                              description: "Past sessions of this type keep it.",
                            });
                          }}
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
