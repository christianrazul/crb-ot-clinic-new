import type { Metadata } from "next";

import { requireScreen } from "@/server/session/require-screen";

import { TodayScreen } from "./_components/today-screen";

export const metadata: Metadata = { title: "Today" };

export default async function Page() {
  await requireScreen("today");
  return <TodayScreen />;
}
