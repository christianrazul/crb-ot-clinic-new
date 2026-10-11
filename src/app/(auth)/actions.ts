"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { ROLE_HOME } from "@/components/app/shell/nav";
import { auth } from "@/server/auth/auth";
import { requestPasswordReset } from "@/server/auth/password-reset";
import { getActor } from "@/server/auth/session";
import { signInWithPassword } from "@/server/auth/sign-in";

export type FormState = { error?: string; message?: string } | undefined;

const clientIp = (h: Headers) =>
  h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");

const signInInput = z.object({
  email: z.email("Enter the email you use for the clinic."),
  password: z.string().min(1, "Enter your password."),
});

export async function signInAction(_state: FormState, form: FormData): Promise<FormState> {
  const parsed = signInInput.safeParse({
    email: form.get("email"),
    password: form.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };

  const requestHeaders = await headers();
  const result = await signInWithPassword({
    ...parsed.data,
    headers: requestHeaders,
    ip: clientIp(requestHeaders),
  });
  if (!result.ok) return { error: result.message };

  const actor = await getActor();
  redirect(actor ? ROLE_HOME[actor.role] : "/");
}

export async function requestResetAction(_state: FormState, form: FormData): Promise<FormState> {
  const parsed = z.email().safeParse(form.get("email"));
  if (!parsed.success) return { error: "Enter the email you use for the clinic." };

  const requestHeaders = await headers();
  const result = await requestPasswordReset(parsed.data, requestHeaders, clientIp(requestHeaders));
  if (!result.ok) return { error: result.message };
  // The same answer whether or not the email has an account.
  return {
    message: "If that email has an account, a reset link is on its way. It works for one hour.",
  };
}

const resetInput = z
  .object({
    token: z.string().min(1),
    password: z.string().min(12, "Use at least 12 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "The two passwords don't match.",
    path: ["confirm"],
  });

export async function resetPasswordAction(_state: FormState, form: FormData): Promise<FormState> {
  const parsed = resetInput.safeParse({
    token: form.get("token"),
    password: form.get("password"),
    confirm: form.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  try {
    await auth.api.resetPassword({
      body: { token: parsed.data.token, newPassword: parsed.data.password },
    });
  } catch {
    return { error: "This reset link has expired or was already used. Ask for a new one." };
  }
  redirect(form.get("invite") ? "/login?welcome=1" : "/login?reset=1");
}
