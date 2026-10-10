"use client";

import * as React from "react";
import { toast } from "sonner";

import { useDemoStore } from "@/components/app/demo/demo-store";
import { SectionHead } from "@/components/app/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { hourLabel } from "@/lib/booking";
import { byId } from "@/lib/demo/selectors";

// Listed Monday first, as the clinic thinks of its week.
const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7:00 AM to 7:00 PM

export function HoursSection() {
  const { state, dispatch, viewer } = useDemoStore();
  const branch = byId(state.branches, viewer.branchId)!;
  const [days, setDays] = React.useState(branch.openDays.map(String));
  const [opens, setOpens] = React.useState(String(branch.opensAtHour));
  const [closes, setCloses] = React.useState(String(branch.closesAtHour));

  const closedDays = DAYS.filter((d) => !days.includes(String(d.value)));
  const invalid = Number(closes) <= Number(opens);

  const save = () => {
    if (invalid || !days.length) return;
    dispatch({
      type: "branch/setHours",
      id: branch.id,
      openDays: days.map(Number),
      opensAtHour: Number(opens),
      closesAtHour: Number(closes),
    });
    toast.success("Operating hours saved", {
      description: `${DAYS.filter((d) => days.includes(String(d.value)))
        .map((d) => d.label)
        .join(", ")}, ${hourLabel(Number(opens))} to ${hourLabel(Number(closes))}`,
    });
  };

  return (
    <>
      <SectionHead
        title="Operating hours"
        description={`When sessions can be booked at ${branch.name}. Sessions start on the hour.`}
      >
        <Button size="sm" onClick={save} disabled={invalid || !days.length}>
          Save changes
        </Button>
      </SectionHead>
      <Card>
        <CardContent className="grid gap-6 p-5">
          <div className="grid gap-2">
            <Label id="clinic-days">Clinic days</Label>
            <ToggleGroup
              type="multiple"
              variant="outline"
              aria-labelledby="clinic-days"
              value={days}
              onValueChange={setDays}
              className="flex-wrap justify-start"
            >
              {DAYS.map((day) => (
                <ToggleGroupItem key={day.value} value={String(day.value)} className="w-14">
                  {day.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <p className="text-xs text-muted-foreground">
              {!days.length
                ? "Pick at least one day."
                : closedDays.length
                  ? `Closed on ${closedDays.map((d) => d.label).join(", ")}.`
                  : "Open every day."}
            </p>
          </div>
          <Separator />
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid w-[160px] gap-1.5">
              <Label htmlFor="opens">Opens</Label>
              <Select value={opens} onValueChange={setOpens}>
                <SelectTrigger id="opens">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {hourLabel(h)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span className="pb-2 text-sm text-muted-foreground">to</span>
            <div className="grid w-[160px] gap-1.5">
              <Label htmlFor="closes">Closes</Label>
              <Select value={closes} onValueChange={setCloses}>
                <SelectTrigger id="closes" aria-invalid={invalid}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {hourLabel(h)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {invalid && (
            <p className="text-sm text-danger-strong">Closing time must be after opening time.</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
