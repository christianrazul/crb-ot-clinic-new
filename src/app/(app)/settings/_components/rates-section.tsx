"use client";

import * as React from "react";
import { toast } from "sonner";

import { useDemoStore } from "@/components/app/demo/demo-store";
import { SectionHead } from "@/components/app/page-layout";
import { SvcDot } from "@/components/app/svc-dot";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputGroup } from "@/components/ui/input";
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

import { digitsOnly } from "./add-form";

export function RatesSection() {
  const { state, dispatch } = useDemoStore();
  const [draft, setDraft] = React.useState(() =>
    Object.fromEntries(
      state.rateClasses.map((r) => [
        r.id,
        { pesos: String(r.rateCentavos / 100), share: String(r.therapistSharePct) },
      ]),
    ),
  );

  const save = () => {
    for (const rateClass of state.rateClasses) {
      const row = draft[rateClass.id]!;
      dispatch({
        type: "rateClass/update",
        id: rateClass.id,
        rateCentavos: Number(row.pesos || 0) * 100,
        therapistSharePct: Math.min(100, Number(row.share || 0)),
      });
    }
    toast.success("Rates saved", {
      description: "New rates apply to sessions marked attended from now on.",
    });
  };

  return (
    <>
      <SectionHead
        title="Rates and splits"
        description="What each role bills per session and how the fee is divided."
      >
        <Button size="sm" onClick={save}>
          Save changes
        </Button>
      </SectionHead>
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead className="w-[150px]">Rate per session</TableHead>
              <TableHead className="w-[120px]">Therapist</TableHead>
              <TableHead className="w-[220px]">Split</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.rateClasses.map((rateClass) => {
              const row = draft[rateClass.id]!;
              const share = Math.min(100, Number(row.share || 0));
              const line = payrollLine(1, Number(row.pesos || 0) * 100, share);
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
                      prefix="₱"
                      aria-label={`${rateClass.name} rate per session`}
                      value={row.pesos}
                      inputMode="numeric"
                      className="w-[120px]"
                      inputClassName="h-8"
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          [rateClass.id]: { ...row, pesos: digitsOnly(event.target.value) },
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <InputGroup
                      suffix="%"
                      aria-label={`${rateClass.name} therapist share`}
                      value={row.share}
                      inputMode="numeric"
                      className="w-[90px]"
                      inputClassName="h-8"
                      onChange={(event) =>
                        setDraft({
                          ...draft,
                          [rateClass.id]: {
                            ...row,
                            share: String(
                              Math.min(100, Number(digitsOnly(event.target.value) || 0)),
                            ),
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
                    <div className="mt-1.5 flex justify-between text-xs text-muted-foreground tabular-nums">
                      <span>Therapist {formatPeso(line.therapistShareCentavos)}</span>
                      <span>Clinic {formatPeso(line.clinicShareCentavos)}</span>
                    </div>
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
