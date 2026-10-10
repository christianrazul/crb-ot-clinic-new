import type { Metadata } from "next";

import { requireScreen } from "@/server/session/require-screen";

import { DashboardScreen } from "./_components/dashboard-screen";

export const metadata: Metadata = { title: "Dashboard" };

export default async function Page() {
  await requireScreen("dashboard");
  return <DashboardScreen />;
}
