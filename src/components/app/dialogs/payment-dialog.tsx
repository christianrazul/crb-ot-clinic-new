"use client";

import { Check, Wallet } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import {
  collectPaymentAction,
  correctPaymentAction,
  getPaymentContextAction,
  getPaymentCorrectionAction,
} from "@/app/(app)/billing/actions";
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
import { Skeleton } from "@/components/ui/skeleton";
import { formatManila } from "@/lib/dates";
import { formatPeso, pesosToCentavos } from "@/lib/money";
import { quotePayment } from "@/lib/payment";
import type { PaymentMethod } from "@/lib/payment-methods";
import { cn } from "@/lib/utils";

import type { PaymentContext } from "@/server/services/payments";

import { MethodPicker } from "./method-picker";
import { useServerData } from "./use-server-data";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
} & (
  | { appointmentId: string; correctPaymentId?: never }
  /** Edit a payment: void it and record the corrected one. */
  | { correctPaymentId: string; appointmentId?: never }
);

const digitsOnly = (value: string) => value.replace(/\D/g, "");
const toCentavos = (digits: string) => (digits ? pesosToCentavos(digits) : null);

export function PaymentDialog({ open, onOpenChange, appointmentId, correctPaymentId }: Props) {
  const loaded = useServerData(() =>
    correctPaymentId
      ? getPaymentCorrectionAction(correctPaymentId)
      : getPaymentContextAction(appointmentId!),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {loaded.data ? (
          loaded.data.alreadyPaid ? (
            <DialogHeader>
              <DialogTitle>Already paid</DialogTitle>
              <DialogDescription>
                This session was paid already. Check the billing list for the receipt.
              </DialogDescription>
            </DialogHeader>
          ) : (
            <PaymentForm context={loaded.data} onOpenChange={onOpenChange} />
          )
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{correctPaymentId ? "Edit payment" : "Collect payment"}</DialogTitle>
              <DialogDescription>{loaded.error ?? "Loading the session…"}</DialogDescription>
            </DialogHeader>
            {!loaded.error && (
              <DialogBody>
                <Skeleton className="h-48" />
              </DialogBody>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PaymentForm({
  context,
  onOpenChange,
}: {
  context: PaymentContext;
  onOpenChange: (open: boolean) => void;
}) {
  const balance = context.creditBalanceCentavos;
  const [useCredit, setUseCredit] = React.useState(balance > 0);
  const [creditText, setCreditText] = React.useState("");
  const [method, setMethod] = React.useState<PaymentMethod>("cash");
  const [receivedText, setReceivedText] = React.useState("");
  const [referenceNo, setReferenceNo] = React.useState("");

  const paymentInput = {
    useCredit,
    creditRequestedCentavos: toCentavos(creditText),
    method,
    cashReceivedCentavos: toCentavos(receivedText),
    referenceNo,
  };
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const correcting = context.correcting;
  const [reason, setReason] = React.useState("");
  const quote = quotePayment({
    ...paymentInput,
    dueCentavos: context.feeCentavos,
    creditBalanceCentavos: balance,
  });
  const name = context.patientName;
  const isCash = method === "cash";

  const confirm = () =>
    startTransition(async () => {
      if (!quote.canConfirm) return;
      setError(null);
      const result = correcting
        ? await correctPaymentAction(correcting.paymentId, reason, paymentInput)
        : await collectPaymentAction({ appointmentId: context.appointmentId, ...paymentInput });
      if (!result.ok) return setError(result.error);
      onOpenChange(false);
      toast.success(correcting ? `Payment corrected for ${name}` : `Payment recorded for ${name}`, {
        description: correcting
          ? `Receipt ${correcting.receiptNo} is voided; the new receipt is ${result.data.receiptNo}.`
          : `${formatPeso(context.feeCentavos)} by ${result.data.methodLabel.toLowerCase()}, receipt ${result.data.receiptNo}`,
      });
      if (result.data.lowCredit) {
        toast.warning(`${name}'s credit is low`, {
          description: `${formatPeso(result.data.creditBalanceAfterCentavos)} left. Remind the guardian to top up.`,
        });
      }
    });

  const cta = !quote.needsMethod
    ? `Pay ${formatPeso(quote.creditAppliedCentavos)} from credit`
    : quote.creditAppliedCentavos > 0
      ? `Confirm ${formatPeso(quote.creditAppliedCentavos)} credit + ${formatPeso(quote.dueNowCentavos)}`
      : `Confirm ${formatPeso(quote.dueNowCentavos)}`;

  const resetCash = () => setReceivedText("");

  return (
    <>
      <DialogHeader>
        <DialogTitle>{correcting ? "Edit payment" : "Collect payment"}</DialogTitle>
        <DialogDescription>
          {formatManila(new Date(context.startsAt), "weekdayDay")} at{" "}
          {formatManila(new Date(context.startsAt), "time")}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-4">
        {correcting && (
          <div className="grid gap-2 rounded-lg border border-warning/40 bg-warning-soft/50 p-3 text-sm">
            <p>
              Replacing receipt <span className="font-medium">{correcting.receiptNo}</span> (
              {correcting.methodLabel.toLowerCase()}). It stays on record as voided, and this
              payment gets a new receipt number.
            </p>
            <div className="grid gap-1">
              <Label htmlFor="correct-reason" className="text-xs">
                Reason for the change
              </Label>
              <Input
                id="correct-reason"
                maxLength={200}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Paid by GCash, not cash"
              />
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 rounded-lg border p-3">
          <PatientAvatar name={name} service={context.service} className="size-9" />
          <div className="grid min-w-0 flex-1 leading-tight">
            <span className="truncate text-sm font-medium">{name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {context.sessionTypeName} with {context.staffName}
            </span>
          </div>
          <span className="text-base font-semibold tabular-nums">
            {formatPeso(context.feeCentavos)}
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
                <span className="text-xs text-muted-foreground">Balance {formatPeso(balance)}</span>
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

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-danger/30 bg-danger-soft/60 px-3 py-2 text-sm text-danger-strong"
          >
            {error}
          </p>
        )}
        <div className="rounded-lg bg-muted/50 px-3.5 py-2.5">
          <SummaryRow label={context.sessionTypeName} value={formatPeso(context.feeCentavos)} />
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
        <Button
          disabled={
            !quote.canConfirm || pending || (Boolean(correcting) && reason.trim().length < 3)
          }
          onClick={confirm}
        >
          {correcting ? "Save corrected payment" : cta}
        </Button>
      </DialogFooter>
    </>
  );
}
