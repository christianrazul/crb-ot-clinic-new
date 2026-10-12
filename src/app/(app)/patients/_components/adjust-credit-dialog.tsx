"use client";

import * as React from "react";
import { toast } from "sonner";

import { adjustCreditAction } from "@/app/(app)/billing/actions";
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
import { InputGroup } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatPeso, pesosToCentavos } from "@/lib/money";

/** Add or remove credit by hand, with a reason, e.g. goodwill credit or a counting error. */
export function AdjustCreditDialog({
  patientId,
  patientName,
  balanceCentavos,
  onClose,
}: {
  patientId: string;
  patientName: string;
  balanceCentavos: number;
  onClose: () => void;
}) {
  const [direction, setDirection] = React.useState<"add" | "remove">("add");
  const [amountText, setAmountText] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const amount = (amountText && pesosToCentavos(amountText)) || 0;
  const signed = direction === "add" ? amount : -amount;
  const after = balanceCentavos + signed;

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await adjustCreditAction({ patientId, amountCentavos: signed, reason });
      if (!result.ok) return setError(result.error);
      toast.success(`${patientName}'s credit adjusted`, {
        description: `Balance now ${formatPeso(result.data.balanceCentavos)}.`,
      });
      onClose();
    });

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Adjust {patientName}&apos;s credit</DialogTitle>
          <DialogDescription>
            For corrections that aren&apos;t a new advance payment. It shows on the ledger with your
            reason.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <ToggleGroup
            type="single"
            variant="segment"
            size="sm"
            aria-label="Add or remove credit"
            value={direction}
            onValueChange={(v) => v && setDirection(v as "add" | "remove")}
          >
            <ToggleGroupItem value="add">Add credit</ToggleGroupItem>
            <ToggleGroupItem value="remove">Remove credit</ToggleGroupItem>
          </ToggleGroup>
          <div className="grid gap-1.5">
            <Label htmlFor="adj-amount">Amount</Label>
            <InputGroup
              id="adj-amount"
              prefix="₱"
              inputMode="numeric"
              placeholder="0"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value.replace(/\D/g, ""))}
            />
            <p className="text-xs text-muted-foreground tabular-nums">
              Balance {formatPeso(balanceCentavos)} → {formatPeso(after)}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="adj-reason">Reason</Label>
            <Textarea
              id="adj-reason"
              rows={2}
              maxLength={200}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Goodwill credit for a cancelled session"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger-strong">
              {error}
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={pending || amount <= 0 || after < 0 || reason.trim().length < 3}
          >
            {direction === "add" ? "Add credit" : "Remove credit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
