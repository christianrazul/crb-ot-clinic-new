"use client";

import { Check, Wallet } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { useDemoStore } from "@/components/app/demo/demo-store";
import { SummaryRow } from "@/components/app/detail-bits";
import { PatientAvatar } from "@/components/app/patient-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, InputGroup } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { formatManila } from "@/lib/dates";
import { appointmentService, byId, creditBalanceOf, displayName } from "@/lib/demo/selectors";
import { formatPeso, pesosToCentavos } from "@/lib/money";
import { quotePayment } from "@/lib/payment";
import type { PaymentMethod } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";

import { MethodPicker } from "./method-picker";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; appointmentId: string };

const digitsOnly = (value: string) => value.replace(/\D/g, "");
const toCentavos = (digits: string) => (digits ? pesosToCentavos(digits) : null);

export function PaymentDialog({ open, onOpenChange, appointmentId }: Props) {
  const { state, dispatch, viewer } = useDemoStore();
  const appointment = byId(state.appointments, appointmentId);
  const balance = appointment ? creditBalanceOf(state, appointment.patientId) : 0;

  const [useCredit, setUseCredit] = React.useState(balance > 0);
  const [creditText, setCreditText] = React.useState("");
  const [method, setMethod] = React.useState<PaymentMethod>("cash");
  const [receivedText, setReceivedText] = React.useState("");
  const [referenceNo, setReferenceNo] = React.useState("");

  const patient = byId(state.patients, appointment?.patientId);
  const staff = byId(state.staff, appointment?.staffId);
  const type = byId(state.sessionTypes, appointment?.sessionTypeId);
  if (!appointment || !patient || !staff || !type) return null;

  const paymentInput = {
    useCredit,
    creditRequestedCentavos: toCentavos(creditText),
    method,
    cashReceivedCentavos: toCentavos(receivedText),
    referenceNo,
  };
  const quote = quotePayment({
    ...paymentInput,
    dueCentavos: appointment.feeCentavos,
    creditBalanceCentavos: balance,
  });
  const name = displayName(patient);
  const isCash = method === "cash";

  const confirm = () => {
    if (!quote.canConfirm) return;
    const receiptNo = `CRB-${state.nextReceiptNo}`;
    dispatch({
      type: "payment/record",
      appointmentId: appointment.id,
      payment: paymentInput,
      receivedByUserId: viewer.user.id,
    });
    onOpenChange(false);
    toast.success(`Payment recorded for ${name}`, {
      description: `${formatPeso(appointment.feeCentavos)} by ${quote.methodLabel.toLowerCase()}, receipt ${receiptNo}`,
    });
  };

  const cta = !quote.needsMethod
    ? `Pay ${formatPeso(quote.creditAppliedCentavos)} from credit`
    : quote.creditAppliedCentavos > 0
      ? `Confirm ${formatPeso(quote.creditAppliedCentavos)} credit + ${formatPeso(quote.dueNowCentavos)}`
      : `Confirm ${formatPeso(quote.dueNowCentavos)}`;

  const resetCash = () => setReceivedText("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Collect payment</DialogTitle>
          <DialogDescription>
            {formatManila(new Date(appointment.startsAt), "weekdayDay")} at{" "}
            {formatManila(new Date(appointment.startsAt), "time")}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <PatientAvatar
              name={name}
              service={appointmentService(state, appointment)}
              className="size-9"
            />
            <div className="grid min-w-0 flex-1 leading-tight">
              <span className="truncate text-sm font-medium">{name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {type.name} with {staff.shortName}
              </span>
            </div>
            <span className="text-base font-semibold tabular-nums">
              {formatPeso(appointment.feeCentavos)}
            </span>
          </div>

          {balance > 0 && (
            <div
              className={cn(
                "rounded-lg border p-3.5 transition-colors",
                useCredit && "border-primary/40 bg-accent/50",
              )}
            >
              <div className="flex items-center gap-3">
                <Wallet className="size-4 text-primary" aria-hidden />
                <div className="grid flex-1 leading-tight">
                  <span className="text-sm font-medium">Use advance credit</span>
                  <span className="text-xs text-muted-foreground">
                    Balance {formatPeso(balance)}
                  </span>
                </div>
                <Switch
                  checked={useCredit}
                  onCheckedChange={(checked) => {
                    setUseCredit(checked);
                    setCreditText("");
                    resetCash();
                  }}
                  aria-label="Use advance credit"
                />
              </div>
              {useCredit && (
                <div className="mt-3 grid animate-in gap-1.5 fade-in-0">
                  <Label htmlFor="credit-amt" className="text-xs">
                    Credit to apply
                  </Label>
                  <div className="flex gap-2">
                    <InputGroup
                      id="credit-amt"
                      prefix="₱"
                      className="flex-1"
                      inputMode="numeric"
                      value={creditText === "" ? String(quote.creditMaxCentavos / 100) : creditText}
                      onChange={(event) => {
                        setCreditText(digitsOnly(event.target.value));
                        resetCash();
                      }}
                    />
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCreditText(String(quote.creditMaxCentavos / 100));
                        resetCash();
                      }}
                    >
                      Max
                    </Button>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Balance after:{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      {formatPeso(quote.creditBalanceAfterCentavos)}
                    </span>
                  </span>
                </div>
              )}
            </div>
          )}

          {!quote.needsMethod ? (
            <div className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2.5 text-sm text-success-strong">
              <Check className="size-4" /> Credit covers this session in full. Nothing to collect.
            </div>
          ) : (
            <>
              {quote.creditAppliedCentavos > 0 && (
                <p className="text-xs text-muted-foreground">
                  Credit covers {formatPeso(quote.creditAppliedCentavos)}. Collect the remaining{" "}
                  {formatPeso(quote.dueNowCentavos)} below.
                </p>
              )}
              <div className="grid gap-1.5">
                <Label>Payment method</Label>
                <MethodPicker
                  value={method}
                  onChange={(next) => {
                    setMethod(next);
                    setReferenceNo("");
                  }}
                />
              </div>
              {isCash ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="recv">Cash received</Label>
                  <div className="flex gap-2">
                    <InputGroup
                      id="recv"
                      prefix="₱"
                      className="flex-1"
                      placeholder="0"
                      inputMode="numeric"
                      value={receivedText}
                      aria-invalid={quote.shortByCentavos !== null}
                      onChange={(event) => setReceivedText(digitsOnly(event.target.value))}
                    />
                    <Button
                      variant="outline"
                      onClick={() => setReceivedText(String(quote.dueNowCentavos / 100))}
                    >
                      Exact
                    </Button>
                  </div>
                  <div className="flex gap-1.5">
                    {[500, 1000, 2000].map((amount) => (
                      <Button
                        key={amount}
                        variant="secondary"
                        size="sm"
                        className="flex-1 tabular-nums"
                        onClick={() => setReceivedText(String(amount))}
                      >
                        {formatPeso(amount * 100)}
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid gap-1.5">
                  <Label htmlFor="ref">Reference number</Label>
                  <Input
                    id="ref"
                    value={referenceNo}
                    onChange={(event) => setReferenceNo(event.target.value)}
                    placeholder="e.g. 0029 8841 552"
                    className="tabular-nums"
                  />
                </div>
              )}
            </>
          )}

          <div className="rounded-lg bg-muted/50 px-3.5 py-2.5">
            <SummaryRow label={type.name} value={formatPeso(appointment.feeCentavos)} />
            {quote.creditAppliedCentavos > 0 && (
              <SummaryRow
                label="Credit applied"
                value={`−${formatPeso(quote.creditAppliedCentavos)}`}
              />
            )}
            <Separator className="my-1.5" />
            <SummaryRow label="Due now" value={formatPeso(quote.dueNowCentavos)} strong />
            {quote.needsMethod && isCash && receivedText && (
              <div
                className={cn(
                  "mt-1.5 flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm",
                  quote.shortByCentavos !== null
                    ? "bg-danger-soft text-danger-strong"
                    : "bg-success-soft text-success-strong",
                )}
              >
                <span>{quote.shortByCentavos !== null ? "Short by" : "Change"}</span>
                <span className="font-semibold tabular-nums">
                  {formatPeso(quote.shortByCentavos ?? quote.changeCentavos ?? 0)}
                </span>
              </div>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!quote.canConfirm} onClick={confirm}>
            {cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
