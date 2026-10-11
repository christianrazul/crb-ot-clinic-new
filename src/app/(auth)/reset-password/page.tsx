import type { Metadata } from "next";
import Link from "next/link";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadInvite } from "@/server/loaders/invite";

import { resetPasswordAction } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string; invite?: string }>;
}) {
  const { token, error, invite } = await searchParams;
  const welcome = token && !error && invite ? await loadInvite(token) : null;
  if (invite && token && !error && !welcome) {
    return (
      <>
        <h1 className="text-lg font-semibold tracking-tight">This invite has expired</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite links work for 3 days and only once. Ask the clinic owner to resend it, or get a
          fresh link yourself.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/forgot-password" className="text-primary underline-offset-4 hover:underline">
            Email me a new link
          </Link>
        </p>
      </>
    );
  }
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
      {welcome ? (
        <>
          <h1 className="text-lg font-semibold tracking-tight">
            Welcome to CRB OT Clinic, {welcome.firstName}
          </h1>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            You&apos;ve been added as {welcome.roleLabel}
            {welcome.branchNames.length ? ` at ${welcome.branchNames.join(" and ")}` : ""}. Choose a
            password of at least 12 characters, then log in with {welcome.email}.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-lg font-semibold tracking-tight">Choose a new password</h1>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            At least 12 characters. You&apos;ll be logged out everywhere else.
          </p>
        </>
      )}
      <AuthForm
        action={resetPasswordAction}
        submitLabel={welcome ? "Set password" : "Save new password"}
        pendingLabel="Saving…"
      >
        <input type="hidden" name="token" value={token} />
        {welcome && <input type="hidden" name="invite" value="1" />}
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
