import "server-only";

import { getDb } from "@/server/db/client";
import { getMyDay } from "@/server/services/notes";
import type { ShellSession } from "@/server/session/shell";

export function loadMyDayPage(session: ShellSession) {
  return getMyDay(getDb(), session.actor);
}
