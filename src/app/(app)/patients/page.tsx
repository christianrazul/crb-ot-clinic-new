import type { Metadata } from "next";

import { patientListParams } from "@/lib/validation/patient";
import { loadPatientsPage } from "@/server/loaders/patients-page";
import { requireScreen } from "@/server/session/require-screen";

import { PatientsScreen } from "./_components/patients-screen";

export const metadata: Metadata = { title: "Patients" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const session = await requireScreen("patients");
  const params = patientListParams.parse(await searchParams);
  const data = await loadPatientsPage(session, params);
  return (
    <PatientsScreen
      params={params}
      data={data}
      isTherapist={session.actor.role === "therapist"}
      branchName={session.branch.name}
    />
  );
}
