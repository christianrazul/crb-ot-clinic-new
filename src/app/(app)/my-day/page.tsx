import type { Metadata } from "next";

import { requireScreen } from "@/server/session/require-screen";

import { MyDayScreen } from "./_components/my-day-screen";

export const metadata: Metadata = { title: "My day" };

export default async function Page() {
  await requireScreen("my-day");
  return <MyDayScreen />;
}
