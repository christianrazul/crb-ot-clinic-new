import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ROLE_HOME } from "@/components/app/shell/nav";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getActor } from "@/server/auth/session";

import { signInAction } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; welcome?: string }>;
}) {
  const actor = await getActor();
  if (actor) redirect(ROLE_HOME[actor.role]);
  const { reset, welcome } = await searchParams;

  return (
    <>
      <h1 className="text-lg font-semibold tracking-tight">Log in</h1>
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        {welcome
          ? "Your password is set. Log in to get started."
          : reset
            ? "Password changed. Log in with your new password."
            : "Use the account the clinic owner set up for you."}
      </p>
      <AuthForm action={signInAction} submitLabel="Log in" pendingLabel="Logging in…">
        <div className="grid gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
        </div>
        <div className="grid gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-primary underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>
      </AuthForm>
    </>
  );
}
