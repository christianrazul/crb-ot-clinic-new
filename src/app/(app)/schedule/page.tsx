import type { Metadata } from "next";

import { requireScreen } from "@/server/session/require-screen";

import { ScheduleScreen } from "./_components/schedule-screen";

export const metadata: Metadata = { title: "Schedule" };

export default async function Page() {
  await requireScreen("schedule");
  return <ScheduleScreen />;
}
