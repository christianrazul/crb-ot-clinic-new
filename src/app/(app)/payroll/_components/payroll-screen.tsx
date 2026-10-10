"use client";

import { Download } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { useDemoStore } from "@/components/app/demo/demo-store";
import { EmptyState } from "@/components/app/detail-bits";
import { Page, PageHeader } from "@/components/app/page-layout";
import { StatStrip } from "@/components/app/stat-strip";
import { SvcDot } from "@/components/app/svc-dot";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { byId } from "@/lib/demo/selectors";
import { initialsOf } from "@/lib/initials";
import { formatPeso } from "@/lib/money";
import { payrollLine, sumPayroll } from "@/lib/payroll";
import { SERVICE_SOFT } from "@/lib/services";
import { cn } from "@/lib/utils";

const PERIODS = {
  daily: { label: "Daily", caption: "Saturday, Aug 22, 2026", divisor: 26 },
  weekly: { label: "Weekly", caption: "Week of Aug 17 to 22, 2026", divisor: 4 },
  monthly: { label: "Monthly", caption: "August 2026", divisor: 1 },
} as const;
type Period = keyof typeof PERIODS;

export function PayrollScreen() {
  const { state } = useDemoStore();
  const [period, setPeriod] = React.useState<Period>("monthly");
  const { caption, divisor } = PERIODS[period];

  // Fixture sessions are monthly totals; Milestone 10 computes these from
  // attended sessions using each session's fee and share snapshot.
  const rows = state.staff
    .filter((s) => s.active && s.monthSessions > 0)
    .map((staff) => {
      const rateClass = byId(state.rateClasses, staff.rateClassId)!;
      const sessions = Math.max(1, Math.round(staff.monthSessions / divisor));
      return {
        staff,
        rateClass,
        line: payrollLine(sessions, rateClass.rateCentavos, rateClass.therapistSharePct),
      };
    });
  const totals = sumPayroll(rows.map((row) => row.line));

  return (
    <Page>
      <PageHeader title="Payroll" description={`Therapist and clinic shares for ${caption}.`}>
        <ToggleGroup
          type="single"
          variant="segment"
          size="sm"
          aria-label="Payroll period"
          value={period}
          onValueChange={(next) => next && setPeriod(next as Period)}
        >
          {(Object.keys(PERIODS) as Period[]).map((key) => (
            <ToggleGroupItem key={key} value={key}>
              {PERIODS[key].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <Button
          size="sm"
          variant="outline"
          disabled={!rows.length}
          onClick={() =>
            toast.success("Payroll exported", { description: `${caption}, ${rows.length} staff` })
          }
        >
          <Download /> Export CSV
        </Button>
      </PageHeader>
      <StatStrip
        items={[
          { label: "Sessions", value: totals.sessions.toLocaleString("en-PH") },
          { label: "Gross billed", value: formatPeso(totals.grossCentavos) },
          { label: "Therapist share", value: formatPeso(totals.therapistShareCentavos) },
          {
            label: "Clinic share",
            value: formatPeso(totals.clinicShareCentavos),
            valueClassName: "text-primary",
          },
        ]}
      />
      <Card className="overflow-hidden">
        {rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Therapist</TableHead>
                <TableHead>Rate class</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Therapist share</TableHead>
                <TableHead className="text-right">Clinic share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ staff, rateClass, line }) => (
                <TableRow key={staff.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-7" aria-hidden>
                        <AvatarFallback
                          className={cn("text-[10px]", SERVICE_SOFT[rateClass.service])}
                        >
                          {initialsOf(staff.displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium whitespace-nowrap">{staff.displayName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2 whitespace-nowrap text-muted-foreground">
                      <SvcDot service={rateClass.service} />
                      {rateClass.name}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{line.sessions}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatPeso(line.rateCentavos)}
                  </TableCell>
                  <TableCell className="text-right">{formatPeso(line.grossCentavos)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatPeso(line.therapistShareCentavos)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatPeso(line.clinicShareCentavos)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell>Total</TableCell>
                <TableCell />
                <TableCell className="text-right">{totals.sessions}</TableCell>
                <TableCell />
                <TableCell className="text-right">{formatPeso(totals.grossCentavos)}</TableCell>
                <TableCell className="text-right">
                  {formatPeso(totals.therapistShareCentavos)}
                </TableCell>
                <TableCell className="text-right text-primary">
                  {formatPeso(totals.clinicShareCentavos)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        ) : (
          <EmptyState
            title="No attended sessions in this period"
            description="Payroll fills in as sessions are marked attended."
          />
        )}
      </Card>
    </Page>
  );
}
