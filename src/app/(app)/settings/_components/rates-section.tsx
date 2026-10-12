"use client";

import * as React from "react";
import { toast } from "sonner";

import { SectionHead } from "@/components/app/page-layout";
import { SvcDot } from "@/components/app/svc-dot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputGroup } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatPeso } from "@/lib/money";
import { payrollLine } from "@/lib/payroll";
import { SERVICE_BG } from "@/lib/services";
import type { SettingsPageData } from "@/server/loaders/settings-page";

import { saveRatesAction, setLowCreditThresholdAction } from "../actions";
import { digitsOnly } from "./add-form";

export function RatesSection({ data }: { data: SettingsPageData }) {
  const [pending, startTransition] = React.useTransition();
  const [draft, setDraft] = React.useState(() =>
    Object.fromEntries(data.rateClasses.map((r) => [r.id, { share: String(r.therapistSharePct) }])),
  );

  const save = () =>
    startTransition(async () => {
      const result = await saveRatesAction(
        data.branch.id,
        data.rateClasses.map((r) => ({
          id: r.id,
          therapistSharePct: Number(draft[r.id]!.share || 0),
        })),
      );
      if (result.ok)
        toast.success("Rates saved", {
          description: "New shares apply to sessions marked attended from now on.",
        });
      else toast.error(result.error);
    });

  return (
    <>
      <SectionHead
        title="Rates and splits"
        description={`The share of each session's fee a therapist earns at ${data.branch.name}. Session fees are set under Session types.`}
      >
        <Button size="sm" onClick={save} loading={pending}>
          Save changes
        </Button>
      </SectionHead>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead className="w-[120px]">Therapist share</TableHead>
              <TableHead className="w-[280px]">For example</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rateClasses.map((rateClass) => {
              const row = draft[rateClass.id]!;
              const share = Math.min(100, Number(row.share || 0));
              const example = exampleSessionFor(rateClass, data.sessionTypes);
              const line = example ? payrollLine(1, example.rateCentavos, share) : null;
              return (
                <TableRow key={rateClass.id}>
                  <TableCell>
                    <span className="flex items-center gap-2 font-medium whitespace-nowrap">
                      <SvcDot service={rateClass.service} />
                      {rateClass.name}
                    </span>
                  </TableCell>
                  <TableCell>
                    <InputGroup
                      suffix="%"
                      aria-label={`${rateClass.name} therapist share`}
                      value={row.share}
                      inputMode="numeric"
                      className="w-[90px]"
                      inputClassName="h-8"
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          [rateClass.id]: {
                            ...row,
                            share: String(Math.min(100, Number(digitsOnly(e.target.value) || 0))),
                          },
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div
                        className={SERVICE_BG[rateClass.service]}
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    {example && line ? (
                      <div className="mt-1.5 grid gap-0.5 text-xs text-muted-foreground tabular-nums">
                        <span className="truncate">
                          {example.name}, {formatPeso(example.rateCentavos)}
                        </span>
                        <span className="flex justify-between">
                          <span>Therapist {formatPeso(line.therapistShareCentavos)}</span>
                          <span>Clinic {formatPeso(line.clinicShareCentavos)}</span>
                        </span>
                      </div>
                    ) : (
                      <div className="mt-1.5 flex justify-between text-xs text-muted-foreground tabular-nums">
                        <span>Therapist {share}%</span>
                        <span>Clinic {100 - share}%</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <LowCreditCard
        branchId={data.branch.id}
        branchName={data.branch.name}
        thresholdCentavos={data.lowCreditThresholdCentavos}
      />
    </>
  );
}

/**
 * A session this role can run at the branch, to show the split in pesos:
 * the priciest matching type, so the example is the one people ask about.
 */
function exampleSessionFor(
  rateClass: SettingsPageData["rateClasses"][number],
  types: SettingsPageData["sessionTypes"],
) {
  const service = rateClass.service === "aide" ? "ot" : rateClass.service;
  return types
    .filter(
      (t) =>
        t.active &&
        t.service === service &&
        (t.allowedRateClassIds === null || t.allowedRateClassIds.includes(rateClass.id)),
    )
    .sort((a, b) => b.rateCentavos - a.rateCentavos)[0];
}

function LowCreditCard({
  branchId,
  branchName,
  thresholdCentavos,
}: {
  branchId: string;
  branchName: string;
  thresholdCentavos: number;
}) {
  const [pending, startTransition] = React.useTransition();
  const [pesos, setPesos] = React.useState(String(thresholdCentavos / 100));
  const save = () =>
    startTransition(async () => {
      const result = await setLowCreditThresholdAction(branchId, Number(pesos || 0));
      if (result.ok)
        toast.success("Reminder saved", {
          description: `Guardians get flagged when credit drops under ${formatPeso(Number(pesos || 0) * 100)}.`,
        });
      else toast.error(result.error);
    });
  return (
    <Card className="mt-4 flex flex-wrap items-end gap-3 p-4">
      <div className="grid min-w-0 flex-1 gap-1.5">
        <Label htmlFor="low-credit">Low credit reminder</Label>
        <p className="text-xs text-muted-foreground">
          Flag a patient at {branchName} when their advance credit falls under this amount.
        </p>
      </div>
      <InputGroup
        id="low-credit"
        prefix="₱"
        inputMode="numeric"
        className="w-[140px]"
        value={pesos}
        onChange={(e) => setPesos(digitsOnly(e.target.value))}
      />
      <Button size="sm" variant="outline" onClick={save} disabled={pending}>
        Save
      </Button>
    </Card>
  );
}
