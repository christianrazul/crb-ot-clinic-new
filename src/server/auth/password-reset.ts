import "server-only";

import { env } from "@/env";
import { getDb } from "@/server/db/client";

import { auth } from "./auth";
import { takeRateLimit } from "./rate-limit";

/**
 * Sends a reset link if the email has an account. Callers show the same
 * message either way, so the form cannot be used to find accounts.
 */
export async function requestPasswordReset(
  email: string,
  requestHeaders: Headers,
  ip: string | null,
) {
  const allowed = await takeRateLimit(getDb(), `reset:${ip ?? "unknown"}`, 5, 15 * 60_000);
  if (!allowed)
    return { ok: false as const, message: "Too many requests. Wait 15 minutes, then try again." };
  await auth.api.requestPasswordReset({
    body: { email: email.toLowerCase(), redirectTo: `${env.NEXT_PUBLIC_APP_URL}/reset-password` },
    headers: requestHeaders,
  });
  return { ok: true as const };
}
