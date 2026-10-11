import "server-only";

import { getDb } from "@/server/db/client";
import { getDashboard } from "@/server/services/dashboard";
import type { ShellSession } from "@/server/session/shell";

export function loadDashboardPage(session: ShellSession) {
  return getDashboard(getDb(), session.actor, { branchId: session.branch.id });
}
