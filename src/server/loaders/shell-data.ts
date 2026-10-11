import "server-only";

import { getDb } from "@/server/db/client";
import { getNotifications } from "@/server/services/notifications";
import type { ShellSession } from "@/server/session/shell";

/** Live data the shell shows on every page: the notifications menu. */
export async function loadShellData(session: ShellSession) {
  return { notifications: await getNotifications(getDb(), session.actor, session.branch.id) };
}
