"use client";

import { Pencil, Plus } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { useDemoStore } from "@/components/app/demo/demo-store";
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

import { AddForm } from "./add-form";

export function BranchesSection() {
  const { state, dispatch } = useDemoStore();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [location, setLocation] = React.useState("");

  return (
    <>
      <SectionHead title="Branches" description="Locations shown in the branch switcher.">
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
          onSubmit={() => {
            const trimmed = name.trim();
            if (!trimmed) return;
            dispatch({ type: "branch/add", name: trimmed, location: location.trim() });
            setName("");
            setLocation("");
            setOpen(false);
            toast.success(`${trimmed} added`, {
              description: "The branch switcher picks it up in Milestone 6.",
            });
          }}
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
              <TableHead className="w-[100px] text-right">
                <span className="sr-only">Action</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.branches.map((branch) => (
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
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    aria-label={`Edit ${branch.name}`}
                    onClick={() =>
                      toast.info("Editing branches is not built yet", {
                        description: "It arrives in Milestone 6.",
                      })
                    }
                  >
                    <Pencil /> Edit
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
