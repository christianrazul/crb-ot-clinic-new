"use client";

import { format, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import * as React from "react";

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
import { initialsOf } from "@/lib/initials";
import { formatPeso } from "@/lib/money";
import { SERVICE_SOFT } from "@/lib/services";
import { cn } from "@/lib/utils";
import type { PayrollPageData } from "@/server/loaders/payroll-page";
import { PAYROLL_PERIODS, type PayrollPeriod } from "@/lib/payroll-periods";

const PERIOD_LABELS: Record<PayrollPeriod, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

function captionFor(data: PayrollPageData) {
  const from = parseISO(data.from);
  const through = parseISO(data.through);
  if (data.period === "daily") return format(from, "EEEE, MMM d, yyyy");
  if (data.period === "monthly") return format(from, "MMMM yyyy");
  return from.getMonth() === through.getMonth()
    ? `Week of ${format(from, "MMM d")} to ${format(through, "d, yyyy")}`
    : `Week of ${format(from, "MMM d")} to ${format(through, "MMM d, yyyy")}`;
}

export function PayrollScreen({ data }: { data: PayrollPageData }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const { rows, totals, period } = data;
  const caption = captionFor(data);
  const go = (next: { period?: PayrollPeriod; date?: string }) =>
    startTransition(() =>
      router.replace(
        `/payroll?period=${next.period ?? period}&date=${next.date ?? data.date}` as Route,
        { scroll: false },
      ),
    );
  const exportHref = `/api/payroll/export?period=${period}&date=${data.date}`;

  return (
    <Page>
      <PageHeader title="Payroll" description={`Therapist and clinic shares for ${caption}.`}>
        <ToggleGroup
          type="single"
          variant="segment"
          size="sm"
          aria-label="Payroll period"
          value={period}
          onValueChange={(next) => next && go({ period: next as PayrollPeriod })}
        >
          {PAYROLL_PERIODS.map((key) => (
            <ToggleGroupItem key={key} value={key}>
              {PERIOD_LABELS[key]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Previous period"
            onClick={() => go({ date: data.previous })}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Next period"
            onClick={() => go({ date: data.next })}
          >
            <ChevronRight />
          </Button>
        </div>
        {rows.length ? (
          <Button size="sm" variant="outline" asChild>
            <a href={exportHref} download>
              <Download /> Export CSV
            </a>
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled>
            <Download /> Export CSV
          </Button>
        )}
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
      <Card className={cn("overflow-hidden", pending && "opacity-70")}>
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
              {rows.map((row) => (
                <TableRow key={row.staffId}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="size-7" aria-hidden>
                        <AvatarFallback className={cn("text-[10px]", SERVICE_SOFT[row.service])}>
                          {initialsOf(row.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium whitespace-nowrap">{row.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2 whitespace-nowrap text-muted-foreground">
                      <SvcDot service={row.service} />
                      {row.rateClassName}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{row.line.sessions}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {row.rateCentavos === null ? "Varies" : formatPeso(row.rateCentavos)}
                  </TableCell>
                  <TableCell className="text-right">{formatPeso(row.line.grossCentavos)}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatPeso(row.line.therapistShareCentavos)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatPeso(row.line.clinicShareCentavos)}
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
