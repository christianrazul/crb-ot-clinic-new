import type { Metadata } from "next";
import { Suspense } from "react";

import { requireScreen } from "@/server/session/require-screen";

import { PatientsScreen } from "./_components/patients-screen";

export const metadata: Metadata = { title: "Patients" };

export default async function Page() {
  await requireScreen("patients");
  return (
    <Suspense>
      <PatientsScreen />
    </Suspense>
  );
}
