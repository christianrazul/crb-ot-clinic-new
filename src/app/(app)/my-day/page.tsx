import type { Metadata } from "next";

import { loadMyDayPage } from "@/server/loaders/my-day-page";
import { requireScreen } from "@/server/session/require-screen";

import { MyDayScreen } from "./_components/my-day-screen";

export const metadata: Metadata = { title: "My day" };

export default async function Page() {
  const session = await requireScreen("my-day");
  const data = await loadMyDayPage(session);
  return <MyDayScreen data={data} firstName={session.actor.name.split(" ")[0]!} />;
}
