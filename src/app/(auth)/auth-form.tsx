"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";

import type { FormState } from "./actions";

/** Shared form shell: server action, inline error or success message, one submit button. */
export function AuthForm({
  action,
  submitLabel,
  pendingLabel,
  children,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  submitLabel: string;
  pendingLabel: string;
  children: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="grid gap-4">
      {children}
      {state?.error && (
        <p
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger-soft/60 px-3 py-2 text-sm text-danger-strong"
        >
          {state.error}
        </p>
      )}
      {state?.message && (
        <p
          role="status"
          className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success-strong"
        >
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}
