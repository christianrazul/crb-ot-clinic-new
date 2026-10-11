"use client";

import { Check, HandCoins } from "lucide-react";

import { EmptyState } from "@/components/app/detail-bits";
import { useDialogs } from "@/components/app/dialogs/dialog-host";
import { Page, PageHeader } from "@/components/app/page-layout";
import { PatientAvatar } from "@/components/app/patient-avatar";
import { StatStrip } from "@/components/app/stat-strip";
import { SvcDot } from "@/components/app/svc-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatManila } from "@/lib/dates";
import { formatPeso } from "@/lib/money";
import type { BillingPageData } from "@/server/loaders/billing-page";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function BillingScreen({ data, branchName }: { data: BillingPageData; branchName: string }) {
  const { openDialog } = useDialogs();
  const { items, totals } = data;

  return (
    <Page>
      <PageHeader
        title="Billing and payments"
        description={`${formatManila(new Date(`${data.date}T04:00:00Z`), "weekdayDayLong")}. Collect at the desk after each session.`}
      >
        <Button size="sm" variant="outline" onClick={() => openDialog({ kind: "advance" })}>
          <HandCoins /> Record advance payment
        </Button>
      </PageHeader>
      <StatStrip
        items={[
          {
            label: "Collected today",
            value: formatPeso(totals.collectedCentavos),
            sub: `${totals.paidCount} of ${items.length} sessions paid`,
          },
          {
            label: "Pending payment",
            value: formatPeso(totals.pendingCentavos),
            valueClassName: totals.pendingCentavos ? "text-warning-strong" : undefined,
            sub: totals.pendingCentavos ? "Waiting at the desk" : "All settled",
          },
          {
            label: "Outstanding balances",
            value: formatPeso(totals.outstandingCentavos),
            valueClassName: totals.outstandingCentavos ? "text-danger" : undefined,
            sub: `Across ${plural(totals.owingPatients, "patient")}`,
          },
          {
            label: "Advance credit on file",
            value: formatPeso(totals.creditOnFileCentavos),
            sub: `${plural(totals.patientsWithCredit, "patient")} with credit`,
          },
        ]}
      />
      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between border-b pb-4">
          <div className="grid gap-1">
            <CardTitle>Today&apos;s sessions</CardTitle>
            <CardDescription>{branchName}</CardDescription>
          </div>
          <div className="flex w-48 flex-col items-end gap-1.5">
            <span className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">
                {totals.paidCount} of {items.length}
              </span>{" "}
              paid
            </span>
            <Progress
              value={items.length ? (totals.paidCount / items.length) * 100 : 0}
              aria-label="Sessions paid"
            />
          </div>
        </CardHeader>
        {items.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead className="hidden md:table-cell">Session</TableHead>
                <TableHead className="hidden lg:table-cell">Therapist</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[120px] text-right">
                  <span className="sr-only">Action</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground">
                    {formatManila(new Date(item.startsAt), "time").replace(/ (AM|PM)$/, "")}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <PatientAvatar
                        name={item.patientName}
                        service={item.service}
                        className="size-7"
                      />
                      <span className="font-medium whitespace-nowrap">{item.patientName}</span>
                      {item.creditCentavos > 0 && (
                        <Badge
                          variant="outline"
                          className="hidden border-primary/30 text-primary sm:inline-flex"
                        >
                          Credit {formatPeso(item.creditCentavos)}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <SvcDot service={item.service} />
                      {item.sessionTypeName}
                    </span>
                  </TableCell>
                  <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                    {item.staffName}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {item.methodLabel ?? <span className="text-warning-strong">Pending</span>}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatPeso(item.feeCentavos)}
                  </TableCell>
                  <TableCell className="text-right">
                    {item.paid ? (
                      <Badge
                        variant="success"
                        title={item.receiptNo ? `Receipt ${item.receiptNo}` : undefined}
                      >
                        <Check /> Paid
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        aria-label={`Collect payment from ${item.patientName}`}
                        onClick={() => openDialog({ kind: "payment", appointmentId: item.id })}
                      >
                        Collect
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="Nothing to collect yet"
            description="Sessions show here once they are checked in or attended."
          />
        )}
      </Card>
    </Page>
  );
}
