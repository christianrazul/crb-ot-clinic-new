import type { Metadata } from "next";
import { Suspense } from "react";

import { requireScreen } from "@/server/session/require-screen";

import { SettingsScreen } from "./_components/settings-screen";

export const metadata: Metadata = { title: "Settings" };

export default async function Page() {
  await requireScreen("settings");
  return (
    <Suspense>
      <SettingsScreen />
    </Suspense>
  );
}
