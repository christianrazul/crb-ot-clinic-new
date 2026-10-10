import type { Metadata } from "next";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { resetPasswordAction } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  if (!token || error) {
    return (
      <>
        <h1 className="text-lg font-semibold tracking-tight">This link doesn&apos;t work</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          It has expired or was already used. Ask for a new one.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/forgot-password" className="text-primary underline-offset-4 hover:underline">
            Email me a new link
          </Link>
        </p>
      </>
    );
  }
  return (
    <>
      <h1 className="text-lg font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        At least 12 characters. You&apos;ll be logged out everywhere else.
      </p>
      <AuthForm action={resetPasswordAction} submitLabel="Save new password" pendingLabel="Saving…">
        <input type="hidden" name="token" value={token} />
        <div className="grid gap-1.5">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
            autoFocus
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="confirm">Repeat new password</Label>
          <Input
            id="confirm"
            name="confirm"
            type="password"
            autoComplete="new-password"
            minLength={12}
            required
          />
        </div>
      </AuthForm>
    </>
  );
}
