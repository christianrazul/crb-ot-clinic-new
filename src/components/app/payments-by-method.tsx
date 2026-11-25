import type * as React from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPeso } from "@/lib/money";
import {
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
  type ReceivedByMethod,
} from "@/lib/payment-methods";
import { cn } from "@/lib/utils";

/** One colour per method, from the chart palette, so each reads the same everywhere. */
const METHOD_COLOR: Record<PaymentMethod, string> = {
  cash: "var(--chart-1)",
  gcash: "var(--chart-2)",
  maya: "var(--chart-3)",
  bank_transfer: "var(--chart-4)",
  card: "var(--chart-5)",
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * Money received split by payment method (cash, GCash, ...): a share bar plus
 * one tile per method, so each channel can be reconciled on its own.
 */
export function PaymentsByMethodCard({
  rows,
  title = "Payments received",
  description,
  action,
  className,
}: {
  rows: ReceivedByMethod;
  title?: string;
  description: React.ReactNode;
  /** e.g. a period toggle, shown at the top right. */
  action?: React.ReactNode;
  className?: string;
}) {
  const total = rows.reduce((sum, r) => sum + r.totalCentavos, 0);
  const count = rows.reduce((sum, r) => sum + r.count, 0);
  const share = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <Card className={className}>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
        <div className="grid gap-1">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <div className="flex items-center gap-4">
          {action}
          <div className="text-right">
            <div className="text-2xl font-semibold tracking-tight tabular-nums">
              {formatPeso(total)}
            </div>
            <div className="text-xs text-muted-foreground">{plural(count, "payment")}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div
          className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={
            total
              ? rows
                  .filter((r) => r.totalCentavos > 0)
                  .map((r) => `${PAYMENT_METHOD_LABELS[r.method]} ${share(r.totalCentavos)}%`)
                  .join(", ")
              : "No payments received"
          }
        >
          {rows
            .filter((r) => r.totalCentavos > 0)
            .map((r) => (
              <div
                key={r.method}
                style={{ flex: r.totalCentavos, background: METHOD_COLOR[r.method] }}
              />
            ))}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {rows.map((r) => (
            <div
              key={r.method}
              className={cn(
                "grid gap-0.5 rounded-lg border px-3 py-2.5",
                !r.totalCentavos && "text-muted-foreground",
              )}
            >
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <span
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{ background: METHOD_COLOR[r.method] }}
                />
                {PAYMENT_METHOD_LABELS[r.method]}
                <span className="ml-auto tabular-nums">{share(r.totalCentavos)}%</span>
              </div>
              <div className="text-lg font-semibold tracking-tight tabular-nums">
                {formatPeso(r.totalCentavos)}
              </div>
              <div className="text-xs text-muted-foreground">{plural(r.count, "payment")}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
