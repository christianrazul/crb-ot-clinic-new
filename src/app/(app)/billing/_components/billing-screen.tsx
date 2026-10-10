"use client";

import { Check, HandCoins } from "lucide-react";

import { useDemoStore } from "@/components/app/demo/demo-store";
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
import {
  appointmentService,
  appointmentsOn,
  byId,
  creditBalanceOf,
  displayName,
  paymentFor,
} from "@/lib/demo/selectors";
import { DEMO_NOW, DEMO_TODAY } from "@/lib/fixtures/demo-clock";
import type { PaymentFixture } from "@/lib/fixtures/payments";
import { formatPeso } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/payment-methods";

const BILLABLE = new Set(["checked_in", "attended"]);

export function methodLabel(payment: PaymentFixture): string {
  if (!payment.method) return "Credit";
  const method = PAYMENT_METHOD_LABELS[payment.method];
  return payment.creditAppliedCentavos > 0 ? `Credit + ${method}` : method;
}

export function BillingScreen() {
  const { state, viewer } = useDemoStore();
  const { openDialog } = useDialogs();

  const rows = appointmentsOn(state, DEMO_TODAY, viewer.branchId).filter((a) =>
    BILLABLE.has(a.status),
  );
  const paidRows = rows.filter((a) => paymentFor(state, a.id));
  const collected = paidRows.reduce((sum, a) => sum + a.feeCentavos, 0);
  const pending = rows
    .filter((a) => !paymentFor(state, a.id))
    .reduce((sum, a) => sum + a.feeCentavos, 0);
  const branchPatients = state.patients.filter(
    (p) => p.branchId === viewer.branchId && !p.deletedAt,
  );
  const owing = branchPatients.filter((p) => p.balanceOwedCentavos > 0);
  const withCredit = branchPatients
    .map((p) => creditBalanceOf(state, p.id))
    .filter((balance) => balance > 0);

  return (
    <Page>
      <PageHeader
        title="Billing and payments"
        description={`${formatManila(DEMO_NOW, "weekdayDayLong")}. Collect at the desk after each session.`}
      >
        <Button size="sm" variant="outline" onClick={() => openDialog({ kind: "advance" })}>
          <HandCoins /> Record advance payment
        </Button>
      </PageHeader>
      <StatStrip
        items={[
          {
            label: "Collected today",
            value: formatPeso(collected),
            sub: `${paidRows.length} of ${rows.length} sessions paid`,
          },
          {
            label: "Pending payment",
            value: formatPeso(pending),
            valueClassName: pending ? "text-warning-strong" : undefined,
            sub: pending ? "Waiting at the desk" : "All settled",
          },
          {
            label: "Outstanding balances",
            value: formatPeso(owing.reduce((sum, p) => sum + p.balanceOwedCentavos, 0)),
            valueClassName: owing.length ? "text-danger" : undefined,
            sub: `Across ${owing.length} patient${owing.length === 1 ? "" : "s"}`,
          },
          {
            label: "Advance credit on file",
            value: formatPeso(withCredit.reduce((sum, balance) => sum + balance, 0)),
            sub: `${withCredit.length} patient${withCredit.length === 1 ? "" : "s"} with credit`,
          },
        ]}
      />
      <Card className="overflow-hidden">
        <CardHeader className="flex-row items-center justify-between border-b pb-4">
          <div className="grid gap-1">
            <CardTitle>Today&apos;s sessions</CardTitle>
            <CardDescription>{viewer.branchName}</CardDescription>
          </div>
          <div className="flex w-48 flex-col items-end gap-1.5">
            <span className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground tabular-nums">
                {paidRows.length} of {rows.length}
              </span>{" "}
              paid
            </span>
            <Progress
              value={rows.length ? (paidRows.length / rows.length) * 100 : 0}
              aria-label="Sessions paid"
            />
          </div>
        </CardHeader>
        {rows.length ? (
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
              {rows.map((appointment) => {
                const patient = byId(state.patients, appointment.patientId);
                const staff = byId(state.staff, appointment.staffId);
                const type = byId(state.sessionTypes, appointment.sessionTypeId);
                if (!patient) return null;
                const payment = paymentFor(state, appointment.id);
                const credit = creditBalanceOf(state, patient.id);
                const service = appointmentService(state, appointment);
                const name = displayName(patient);
                return (
                  <TableRow key={appointment.id}>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatManila(new Date(appointment.startsAt), "time").replace(
                        / (AM|PM)$/,
                        "",
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <PatientAvatar name={name} service={service} className="size-7" />
                        <span className="font-medium whitespace-nowrap">{name}</span>
                        {credit > 0 && (
                          <Badge
                            variant="outline"
                            className="hidden border-primary/30 text-primary sm:inline-flex"
                          >
                            Credit {formatPeso(credit)}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <SvcDot service={service} />
                        {type?.name}
                      </span>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-muted-foreground lg:table-cell">
                      {staff?.shortName}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {payment ? (
                        methodLabel(payment)
                      ) : (
                        <span className="text-warning-strong">Pending</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatPeso(appointment.feeCentavos)}
                    </TableCell>
                    <TableCell className="text-right">
                      {payment ? (
                        <Badge variant="success">
                          <Check /> Paid
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          aria-label={`Collect payment from ${name}`}
                          onClick={() =>
                            openDialog({ kind: "payment", appointmentId: appointment.id })
                          }
                        >
                          Collect
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
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
