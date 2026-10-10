"use client";

import type * as React from "react";

import { Button } from "@/components/ui/button";

/** Inline form that slides in above a settings table. */
export function AddForm({
  open,
  children,
  onCancel,
  onSubmit,
  submitLabel,
}: {
  open: boolean;
  children: React.ReactNode;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
}) {
  if (!open) return null;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      className="flex animate-in flex-wrap items-end gap-3 border-b bg-muted/40 p-4 fade-in-0 slide-in-from-top-1"
    >
      {children}
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="h-9">
          {submitLabel}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-9" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Keeps only digits, for whole-peso and percent inputs. */
export const digitsOnly = (value: string) => value.replace(/\D/g, "");
