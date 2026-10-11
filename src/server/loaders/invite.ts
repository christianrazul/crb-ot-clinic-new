import "server-only";

import { describeInvite } from "@/server/auth/invites";
import { getDb } from "@/server/db/client";

/** Who an invite link is for, or null when it has expired or was used. */
export function loadInvite(token: string) {
  if (token.length > 200) return Promise.resolve(null);
  return describeInvite(getDb(), token);
}
