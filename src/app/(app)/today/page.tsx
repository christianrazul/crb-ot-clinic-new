import type { Metadata } from "next";

import { loadTodayPage } from "@/server/loaders/today-page";
import { requireScreen } from "@/server/session/require-screen";

import { TodayScreen } from "./_components/today-screen";

export const metadata: Metadata = { title: "Today" };

export default async function Page() {
  const session = await requireScreen("today");
  const data = await loadTodayPage(session);
  return <TodayScreen data={data} firstName={session.actor.name.split(" ")[0]!} />;
}
