"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  correctTopUpAction,
  getCreditBalanceAction,
  recordTopUpAction,
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
import { Textarea } from "@/components/ui/textarea";
import { formatManila } from "@/lib/dates";
import { formatPeso, pesosToCentavos } from "@/lib/money";
import type { PaymentMethod } from "@/lib/payment-methods";
import type { ServiceKey } from "@/lib/services";
import { cn } from "@/lib/utils";

import { MethodPicker } from "./method-picker";
import { PatientCombobox } from "./patient-combobox";

const PACKAGES = [
  { pesos: 3500, label: "5 sessions" },
  { pesos: 7000, label: "10 sessions" },
  { pesos: 14000, label: "20 sessions" },
];
/** The usual OT session fee, for the "covers about N sessions" hint. */
const OT_SESSION_CENTAVOS = 70_000;

type Picked = { id: string; name: string; service: ServiceKey };
/** An advance payment being edited: it is voided and replaced by the corrected one. */
export type TopUpCorrection = {
  entryId: string;
  amountCentavos: number;
  method: PaymentMethod | null;
  referenceNo: string | null;
  receiptNo: string;
  notes: string | null;
};
type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preselected and locked, when opened from a patient record. */
  patient?: Picked;
  today: string;
  correcting?: TopUpCorrection;
};

/** Advance payment: non-refundable credit added to the patient's ledger. */
export function AdvancePaymentDialog({
  open,
  onOpenChange,
  patient: locked,
  today,
  correcting,
}: Props) {
  const [patient, setPatient] = React.useState<Picked | null>(locked ?? null);
  const [current, setCurrent] = React.useState<number | null>(null);
  const [query, setQuery] = React.useState("");
  const [amountText, setAmountText] = React.useState(
    correcting ? String(correcting.amountCentavos / 100) : "",
  );
  const [method, setMethod] = React.useState<PaymentMethod>(correcting?.method ?? "cash");
  const [referenceNo, setReferenceNo] = React.useState(correcting?.referenceNo ?? "");
  const [receiptNo, setReceiptNo] = React.useState(correcting?.receiptNo ?? "");
  const [notes, setNotes] = React.useState(correcting?.notes ?? "");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  // Load the patient's current balance whenever the patient changes.
  React.useEffect(() => {
    if (!patient) return;
    let cancelled = false;
    getCreditBalanceAction(patient.id).then((result) => {
      if (!cancelled) setCurrent(result.ok ? result.data : 0);
    });
    return () => {
      cancelled = true;
    };
  }, [patient]);

  const amount = amountText ? (pesosToCentavos(amountText) ?? 0) : 0;
  // When editing, the entry being replaced no longer counts.
  const balance = (current ?? 0) - (correcting?.amountCentavos ?? 0);
  const isCash = method === "cash";
  const canConfirm =
    Boolean(patient) &&
    amount > 0 &&
    (isCash || referenceNo.trim().length > 0) &&
    (!correcting || reason.trim().length >= 3) &&
    !pending;

  const confirm = () =>
    startTransition(async () => {
      if (!patient) return;
      setError(null);
      const values = {
        patientId: patient.id,
        amountCentavos: amount,
        method,
        referenceNo,
        receiptNo,
        notes,
      };
      const result = correcting
        ? await correctTopUpAction(correcting.entryId, reason, values)
        : await recordTopUpAction(values);
      if (!result.ok) return setError(result.error);
      onOpenChange(false);
      toast.success(
        correcting
          ? `Advance corrected for ${patient.name}`
          : `Advance recorded for ${patient.name}`,
        {
          description: correcting
            ? `The old entry is voided. Balance now ${formatPeso(result.data.balanceCentavos)}.`
            : `${formatPeso(amount)} added to credit, receipt ${result.data.receiptNo}`,
        },
      );
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {correcting ? "Edit advance payment" : "Record advance payment"}
          </DialogTitle>
          <DialogDescription>
            {formatManila(new Date(`${today}T04:00:00Z`), "weekdayDay")}. Advance payments are
            non-refundable credit.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          {correcting && (
            <div className="grid gap-2 rounded-lg border border-warning/40 bg-warning-soft/50 p-3 text-sm">
              <p>
                The {formatPeso(correcting.amountCentavos)} entry (receipt {correcting.receiptNo})
                stays on record as voided, and the corrected one replaces it.
              </p>
              <div className="grid gap-1">
                <Label htmlFor="tu-reason" className="text-xs">
                  Reason for the change
                </Label>
                <Input
                  id="tu-reason"
                  maxLength={200}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Typed ₱3,500, received ₱3,000"
                />
              </div>
            </div>
          )}
          <div className="grid gap-1.5">
            <Label htmlFor="tu-patient">Patient</Label>
            {locked ? (
              <div className="flex items-center gap-2.5 rounded-md border bg-muted/40 px-3 py-2">
                <PatientAvatar
                  name={locked.name}
                  service={locked.service}
                  className="size-6 text-[10px]"
                />
                <span className="text-sm font-medium">{locked.name}</span>
              </div>
            ) : (
              <PatientCombobox
                id="tu-patient"
                value={patient?.id ?? null}
                selected={patient}
                query={query}
                onQueryChange={setQuery}
                onPick={(picked) => {
                  setCurrent(null);
                  setPatient(picked);
                }}
                placeholder="Select a patient"
              />
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tu-amt">Amount received</Label>
            <InputGroup
              id="tu-amt"
              prefix="₱"
              placeholder="0"
              inputMode="numeric"
              value={amountText}
              onChange={(event) => setAmountText(event.target.value.replace(/\D/g, ""))}
              inputClassName="h-10 text-base font-medium"
            />
            <div className="flex gap-1.5">
              {PACKAGES.map(({ pesos, label }) => (
                <Button
                  key={pesos}
                  variant="secondary"
                  size="sm"
                  className="h-auto flex-1 flex-col gap-0 py-1.5"
                  onClick={() => setAmountText(String(pesos))}
                >
                  <span className="tabular-nums">{formatPeso(pesos * 100)}</span>
                  <span className="text-[10.5px] font-normal text-muted-foreground">{label}</span>
                </Button>
              ))}
            </div>
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
                <Label htmlFor="tu-ref">Reference no.</Label>
                <Input
                  id="tu-ref"
                  value={referenceNo}
                  onChange={(event) => setReferenceNo(event.target.value)}
                  placeholder="0029 8841 552"
                />
              </div>
            )}
            <div className={cn("grid gap-1.5", isCash && "col-span-2")}>
              <Label htmlFor="tu-rc">
                Receipt no.{" "}
                <span className="font-normal text-muted-foreground">(blank: next number)</span>
              </Label>
              <Input
                id="tu-rc"
                value={receiptNo}
                onChange={(event) => setReceiptNo(event.target.value)}
                placeholder="Automatic"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tu-notes">
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="tu-notes"
              rows={2}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Who paid, the package agreed, reminders to set"
            />
          </div>
          <div className="rounded-lg bg-muted/50 px-3.5 py-2.5">
            <SummaryRow
              label="Current credit"
              value={patient && current === null ? "…" : formatPeso(balance)}
            />
            <SummaryRow label="Advance received" value={amount ? `+${formatPeso(amount)}` : "–"} />
            <Separator className="my-1.5" />
            <SummaryRow label="Balance after" value={formatPeso(balance + amount)} strong />
            {amount > 0 && (
              <p className="pt-1 text-xs text-muted-foreground">
                Covers about {Math.floor((balance + amount) / OT_SESSION_CENTAVOS)} OT sessions at{" "}
                {formatPeso(OT_SESSION_CENTAVOS)}.
              </p>
            )}
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
            {correcting
              ? "Save corrected advance"
              : amount
                ? `Record ${formatPeso(amount)}`
                : "Record advance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
