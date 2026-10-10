"use client";

import { Banknote, CreditCard, Landmark, type LucideIcon, Smartphone } from "lucide-react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PAYMENT_METHOD_LABELS, PAYMENT_METHODS, type PaymentMethod } from "@/lib/payment-methods";

const ICONS: Record<PaymentMethod, LucideIcon> = {
  cash: Banknote,
  gcash: Smartphone,
  maya: Smartphone,
  bank_transfer: Landmark,
  card: CreditCard,
};

export function MethodPicker({
  value,
  onChange,
}: {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      aria-label="Payment method"
      value={value}
      onValueChange={(next) => next && onChange(next as PaymentMethod)}
      className="grid grid-cols-3 gap-2 sm:grid-cols-5"
    >
      {PAYMENT_METHODS.map((method) => {
        const Icon = ICONS[method];
        return (
          <ToggleGroupItem
            key={method}
            value={method}
            aria-label={PAYMENT_METHOD_LABELS[method]}
            className="h-auto flex-col gap-1 px-1 py-2 text-xs data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
          >
            <Icon className="size-4!" />
            {method === "bank_transfer" ? "Bank" : PAYMENT_METHOD_LABELS[method]}
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
