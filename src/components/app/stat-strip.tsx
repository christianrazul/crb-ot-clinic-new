import { TrendingDown, TrendingUp } from "lucide-react";
import type * as React from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type Stat = {
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
  /** e.g. "8.4%". Shown with an arrow. */
  delta?: string;
  up?: boolean;
  /** Whether the change is good news (green) or bad (red). */
  good?: boolean;
  deltaNote?: string;
  sub?: React.ReactNode;
};

/** Four key figures in one card; two columns on small screens. */
export function StatStrip({ items }: { items: Stat[] }) {
  return (
    // Two columns on small screens, four from lg. Borders are explicit because
    // Tailwind v4's divide utilities clash with the per-column rules.
    <Card className="grid grid-cols-2 overflow-hidden lg:grid-cols-4 lg:[&>*]:border-r lg:[&>*:last-child]:border-r-0 [&>*:nth-child(-n+2)]:border-b lg:[&>*:nth-child(-n+2)]:border-b-0 [&>*:nth-child(odd)]:border-r">
      {items.map((stat) => (
        <div key={stat.label} className="flex flex-col gap-1 p-4 md:p-5">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            {stat.label}
          </div>
          <div
            className={cn(
              "text-2xl font-semibold tracking-tight tabular-nums",
              stat.valueClassName,
            )}
          >
            {stat.value}
          </div>
          {stat.delta && (
            <div className="flex items-center gap-1.5 text-xs">
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 font-medium",
                  stat.good ? "text-success-strong" : "text-danger-strong",
                )}
              >
                {stat.up ? (
                  <TrendingUp className="size-3.5" aria-label="Up" />
                ) : (
                  <TrendingDown className="size-3.5" aria-label="Down" />
                )}
                {stat.delta}
              </span>
              <span className="text-muted-foreground">{stat.deltaNote ?? "vs last month"}</span>
            </div>
          )}
          {stat.sub && <div className="text-xs text-muted-foreground">{stat.sub}</div>}
        </div>
      ))}
    </Card>
  );
}
