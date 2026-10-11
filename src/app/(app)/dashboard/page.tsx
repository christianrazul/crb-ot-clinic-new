import type { Metadata } from "next";

import { loadDashboardPage } from "@/server/loaders/dashboard-page";
import { requireScreen } from "@/server/session/require-screen";

import { DashboardScreen } from "./_components/dashboard-screen";

export const metadata: Metadata = { title: "Dashboard" };

export default async function Page() {
  const session = await requireScreen("dashboard");
  const data = await loadDashboardPage(session);
  return <DashboardScreen data={data} branchName={session.branch.name} />;
}
