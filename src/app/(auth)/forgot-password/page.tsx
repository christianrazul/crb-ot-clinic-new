import type { Metadata } from "next";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { requestResetAction } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-lg font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        We&apos;ll email you a link to choose a new one.
      </p>
      <AuthForm action={requestResetAction} submitLabel="Email reset link" pendingLabel="Sending…">
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
        </div>
      </AuthForm>
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          Back to log in
        </Link>
      </p>
    </>
  );
}
