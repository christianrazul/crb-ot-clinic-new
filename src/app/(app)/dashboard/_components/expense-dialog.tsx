"use client";

import { Receipt } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input, InputGroup } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPeso, pesosToCentavos } from "@/lib/money";
import { EXPENSE_CATEGORIES } from "@/lib/validation/expenses";

import { recordExpenseAction } from "../actions";

/** Records rent, utilities and other running costs for the cash flow chart. */
export function ExpenseDialog({ branchName, today }: { branchName: string; today: string }) {
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState<string>("");
  const [amountText, setAmountText] = React.useState("");
  const [spentOn, setSpentOn] = React.useState(today);
  const [description, setDescription] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const reset = () => {
    setCategory("");
    setAmountText("");
    setSpentOn(today);
    setDescription("");
    setError(null);
  };
  const amountCentavos = (amountText && pesosToCentavos(amountText)) || 0;

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await recordExpenseAction({ category, amountCentavos, spentOn, description });
      if (!result.ok) return setError(result.error);
      setOpen(false);
      reset();
      toast.success("Expense recorded", {
        description: `${category}, ${formatPeso(amountCentavos)}`,
      });
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Receipt /> Record expense
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record expense</DialogTitle>
          <DialogDescription>Money {branchName} spent. It shows in cash flow.</DialogDescription>
        </DialogHeader>
        <DialogBody className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="expense-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="expense-category">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="expense-amount">Amount</Label>
              <InputGroup
                id="expense-amount"
                prefix="₱"
                inputMode="numeric"
                placeholder="0"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="expense-date">Date</Label>
              <Input
                id="expense-date"
                type="date"
                max={today}
                value={spentOn}
                onChange={(e) => setSpentOn(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="expense-description">Description</Label>
            <Input
              id="expense-description"
              maxLength={200}
              placeholder="Optional"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!category || amountCentavos <= 0 || pending} onClick={save}>
            Record {amountCentavos > 0 ? formatPeso(amountCentavos) : "expense"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
