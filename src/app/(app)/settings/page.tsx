import type { Metadata } from "next";
import { Suspense } from "react";

import { loadSettingsPage } from "@/server/loaders/settings-page";
import { requireScreen } from "@/server/session/require-screen";

import { SettingsScreen } from "./_components/settings-screen";

export const metadata: Metadata = { title: "Settings" };

export default async function Page() {
  const session = await requireScreen("settings");
  const data = await loadSettingsPage(session);
  return (
    <Suspense>
      <SettingsScreen data={data} />
    </Suspense>
  );
}
