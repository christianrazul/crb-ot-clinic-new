"use client";

import { Plus } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { SectionHead } from "@/components/app/page-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { branchSubtitle } from "@/lib/fixtures/branches";
import type { SettingsPageData } from "@/server/loaders/settings-page";

import { addBranchAction } from "../actions";
import { AddForm } from "./add-form";

export function BranchesSection({ data }: { data: SettingsPageData }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [, startTransition] = React.useTransition();

  return (
    <>
      <SectionHead
        title="Branches"
        description="Locations shown in the branch switcher. A new branch starts with a copy of the main branch's rates, session types and hours."
      >
        {!open && (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus /> Add branch
          </Button>
        )}
      </SectionHead>
      <Card className="overflow-hidden">
        <AddForm
          open={open}
          submitLabel="Add branch"
          onCancel={() => setOpen(false)}
          onSubmit={() =>
            startTransition(async () => {
              const result = await addBranchAction({
                name: name.trim(),
                location: location.trim(),
              });
              if (!result.ok) return void toast.error(result.error);
              setName("");
              setLocation("");
              setOpen(false);
              toast.success(`${result.data.name} added`, {
                description: "It's in the branch switcher now.",
              });
            })
          }
        >
          <div className="grid min-w-[180px] flex-1 gap-1.5">
            <Label htmlFor="br-name">Branch name</Label>
            <Input
              id="br-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CRB Toril"
            />
          </div>
          <div className="grid min-w-[180px] flex-1 gap-1.5">
            <Label htmlFor="br-location">Location</Label>
            <Input
              id="br-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Toril, Davao City"
            />
          </div>
        </AddForm>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Branch</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-right">Hours</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.branches.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-7 items-center justify-center rounded-md border bg-background text-[11px] font-semibold">
                      {branch.code}
                    </span>
                    <span className="font-medium">{branch.name}</span>
                    {branch.isMain && <Badge variant="secondary">Main</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{branchSubtitle(branch)}</TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {branch.opensAtHour}:00 to {branch.closesAtHour}:00
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
