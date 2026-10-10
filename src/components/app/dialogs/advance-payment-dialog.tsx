"use client";

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
import { Textarea } from "@/components/ui/textarea";
import { formatManila } from "@/lib/dates";
import { byId, creditBalanceOf, displayName, visiblePatients } from "@/lib/demo/selectors";
import { DEMO_NOW } from "@/lib/fixtures/demo-clock";
import { formatPeso, pesosToCentavos } from "@/lib/money";
import type { PaymentMethod } from "@/lib/payment-methods";
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

type Props = { open: boolean; onOpenChange: (open: boolean) => void; patientId?: string };

/** Advance payment: non-refundable credit added to the patient's ledger. */
export function AdvancePaymentDialog({ open, onOpenChange, patientId: lockedPatientId }: Props) {
  const { state, dispatch, viewer } = useDemoStore();
  const [patientId, setPatientId] = React.useState<string | null>(lockedPatientId ?? null);
  const [query, setQuery] = React.useState("");
  const [amountText, setAmountText] = React.useState("");
  const [method, setMethod] = React.useState<PaymentMethod>("cash");
  const [referenceNo, setReferenceNo] = React.useState("");
  const [receiptNo, setReceiptNo] = React.useState("");
  const [notes, setNotes] = React.useState("");

  const patient = byId(state.patients, patientId);
  const amount = amountText ? (pesosToCentavos(amountText) ?? 0) : 0;
  const current = patientId ? creditBalanceOf(state, patientId) : 0;
  const isCash = method === "cash";
  const canConfirm = Boolean(patient) && amount > 0 && (isCash || referenceNo.trim().length > 0);

  const confirm = () => {
    if (!canConfirm || !patient) return;
    dispatch({
      type: "credit/topUp",
      patientId: patient.id,
      amountCentavos: amount,
      method,
      referenceNo,
      receiptNo,
      notes,
    });
    onOpenChange(false);
    toast.success(`Advance recorded for ${displayName(patient)}`, {
      description: `${formatPeso(amount)} added to credit`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record advance payment</DialogTitle>
          <DialogDescription>
            {formatManila(DEMO_NOW, "weekdayDay")}. Advance payments are non-refundable credit.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="tu-patient">Patient</Label>
            {lockedPatientId && patient ? (
              <div className="flex items-center gap-2.5 rounded-md border bg-muted/40 px-3 py-2">
                <PatientAvatar
                  name={displayName(patient)}
                  service={patient.service}
                  className="size-6 text-[10px]"
                />
                <span className="text-sm font-medium">{displayName(patient)}</span>
              </div>
            ) : (
              <PatientCombobox
                id="tu-patient"
                value={patientId}
                query={query}
                onQueryChange={setQuery}
                patients={visiblePatients(state, viewer.role, viewer.staffId, viewer.branchId)}
                creditOf={(id) => creditBalanceOf(state, id)}
                onPick={setPatientId}
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
              <Label htmlFor="tu-rc">Receipt no.</Label>
              <Input
                id="tu-rc"
                value={receiptNo}
                onChange={(event) => setReceiptNo(event.target.value)}
                placeholder={`CRB-${state.nextReceiptNo}`}
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
            <SummaryRow label="Current credit" value={formatPeso(current)} />
            <SummaryRow label="Advance received" value={amount ? `+${formatPeso(amount)}` : "–"} />
            <Separator className="my-1.5" />
            <SummaryRow label="Balance after" value={formatPeso(current + amount)} strong />
            {amount > 0 && (
              <p className="pt-1 text-xs text-muted-foreground">
                Covers about {Math.floor((current + amount) / OT_SESSION_CENTAVOS)} OT sessions at{" "}
                {formatPeso(OT_SESSION_CENTAVOS)}.
              </p>
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canConfirm} onClick={confirm}>
            {amount ? `Record ${formatPeso(amount)}` : "Record advance"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
