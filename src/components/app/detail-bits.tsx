import type * as React from "react";

import { cn } from "@/lib/utils";

/** Two-column grid of labelled facts, used in session dialogs. */
export function InfoGrid({
  items,
}: {
  items: { label: string; value: React.ReactNode; sub?: React.ReactNode }[];
}) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border">
      {items.map(({ label, value, sub }) => (
        <div key={label} className="bg-background px-3.5 py-2.5">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 text-sm font-medium">{value}</dd>
          {sub && <dd className="text-xs text-muted-foreground">{sub}</dd>}
        </div>
      ))}
    </dl>
  );
}

/** One line in a payment summary. */
export function SummaryRow({
  label,
  value,
  strong,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between py-1 text-sm", className)}>
      <span className={strong ? "font-medium" : "text-muted-foreground"}>{label}</span>
      <span className={cn("tabular-nums", strong ? "text-base font-semibold" : "font-medium")}>
        {value}
      </span>
    </div>
  );
}

/** A labelled value in the patient overview. */
export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-0.5", className)}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
    </div>
  );
}

/** What a list shows when it has nothing in it. Says why and what to do. */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-5 py-10 text-center", className)}>
      <div className="text-sm font-medium">{title}</div>
      {description && <div className="mt-1 text-sm text-muted-foreground">{description}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
