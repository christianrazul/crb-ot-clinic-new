"use client";

import * as React from "react";
import { toast } from "sonner";

import { getDebtBalanceAction, recordDebtPaymentAction } from "@/app/(app)/billing/actions";
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
import { Textarea } from "@/components/ui/textarea";
import { formatPeso, pesosToCentavos } from "@/lib/money";
import type { PaymentMethod } from "@/lib/payment-methods";
import type { ServiceKey } from "@/lib/services";
import { cn } from "@/lib/utils";

import { MethodPicker } from "./method-picker";
import { useServerData } from "./use-server-data";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: { id: string; name: string; service: ServiceKey };
  today: string;
};

/** Money received against a patient's tab (D-129). Never more than they owe. */
export function DebtPaymentDialog({ open, onOpenChange, patient, today }: Props) {
  const owed = useServerData(() => getDebtBalanceAction(patient.id));
  const [amountText, setAmountText] = React.useState("");
  const [method, setMethod] = React.useState<PaymentMethod>("cash");
  const [referenceNo, setReferenceNo] = React.useState("");
  const [receiptNo, setReceiptNo] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [receivedOn, setReceivedOn] = React.useState(today);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const balance = owed.data ?? 0;
  const amount = amountText ? (pesosToCentavos(amountText) ?? 0) : 0;
  const tooMuch = owed.data !== null && amount > balance;
  const isCash = method === "cash";
  const canConfirm =
    owed.data !== null &&
    amount > 0 &&
    !tooMuch &&
    (isCash || referenceNo.trim().length > 0) &&
    !pending;
  const firstName = patient.name.split(" ")[0];

  const confirm = () =>
    startTransition(async () => {
      setError(null);
      const result = await recordDebtPaymentAction({
        patientId: patient.id,
        amountCentavos: amount,
        method,
        referenceNo,
        receiptNo,
        notes,
        receivedOn: receivedOn || undefined,
      });
      if (!result.ok) return setError(result.error);
      onOpenChange(false);
      toast.success(`Debt payment recorded for ${patient.name}`, {
        description: result.data.debtBalanceCentavos
          ? `${formatPeso(amount)} received, receipt ${result.data.receiptNo}. Still owes ${formatPeso(result.data.debtBalanceCentavos)}.`
          : `${formatPeso(amount)} received, receipt ${result.data.receiptNo}. Debt paid in full.`,
      });
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record debt payment</DialogTitle>
          <DialogDescription>
            Money received for sessions {firstName} didn&apos;t pay in full.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <PatientAvatar name={patient.name} service={patient.service} className="size-9" />
            <div className="grid min-w-0 flex-1 leading-tight">
              <span className="truncate text-sm font-medium">{patient.name}</span>
              <span className="text-xs text-muted-foreground">Owes</span>
            </div>
            <span className="text-base font-semibold text-danger tabular-nums">
              {owed.data === null ? "…" : formatPeso(balance)}
            </span>
          </div>
          {owed.error && <p className="text-sm text-danger-strong">{owed.error}</p>}

          <div className="grid gap-1.5">
            <Label htmlFor="debt-amt">Amount received</Label>
            <div className="flex gap-2">
              <InputGroup
                id="debt-amt"
                prefix="₱"
                placeholder="0"
                inputMode="numeric"
                className="flex-1"
                value={amountText}
                aria-invalid={tooMuch}
                onChange={(event) => setAmountText(event.target.value.replace(/\D/g, ""))}
                inputClassName="h-10 text-base font-medium"
              />
              <Button
                variant="outline"
                className="h-10"
                disabled={!balance}
                onClick={() => setAmountText(String(balance / 100))}
              >
                Full amount
              </Button>
            </div>
            {tooMuch && (
              <p className="text-xs text-danger-strong">
                That&apos;s more than {firstName} owes. Record the extra as an advance payment.
              </p>
            )}
          </div>
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
          <div className="grid grid-cols-2 gap-3">
            {!isCash && (
              <div className="grid gap-1.5">
                <Label htmlFor="debt-ref">Reference no.</Label>
                <Input
                  id="debt-ref"
                  value={referenceNo}
                  onChange={(event) => setReferenceNo(event.target.value)}
                  placeholder="0029 8841 552"
                />
              </div>
            )}
            <div className={cn("grid gap-1.5", isCash && "col-span-2")}>
              <Label htmlFor="debt-rc">
                Receipt no.{" "}
                <span className="font-normal text-muted-foreground">(blank: next number)</span>
              </Label>
              <Input
                id="debt-rc"
                value={receiptNo}
                onChange={(event) => setReceiptNo(event.target.value)}
                placeholder="Automatic"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="debt-received-on">Received on</Label>
            <Input
              id="debt-received-on"
              type="date"
              value={receivedOn}
              max={today}
              onChange={(event) => setReceivedOn(event.target.value)}
              className="tabular-nums"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="debt-notes">
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="debt-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Who paid, when the rest is promised"
            />
          </div>
          <div className="rounded-lg bg-muted/50 px-3.5 py-2.5">
            <SummaryRow label="Owes now" value={formatPeso(balance)} />
            <SummaryRow label="Received" value={amount ? `−${formatPeso(amount)}` : "–"} />
            <Separator className="my-1.5" />
            <SummaryRow
              label="Still owes"
              value={formatPeso(Math.max(0, balance - amount))}
              strong
            />
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-danger/30 bg-danger-soft/60 px-3 py-2 text-sm text-danger-strong"
            >
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canConfirm} onClick={confirm}>
            {amount ? `Record ${formatPeso(amount)}` : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
