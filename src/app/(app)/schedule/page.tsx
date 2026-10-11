import type { Metadata } from "next";

import { loadSchedulePage } from "@/server/loaders/schedule-page";
import { requireScreen } from "@/server/session/require-screen";

import { ScheduleScreen } from "./_components/schedule-screen";

export const metadata: Metadata = { title: "Schedule" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const session = await requireScreen("schedule");
  const data = await loadSchedulePage(session, await searchParams);
  return <ScheduleScreen data={data} isTherapist={session.actor.role === "therapist"} />;
}
