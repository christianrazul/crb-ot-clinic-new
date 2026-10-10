import type { Metadata } from "next";

import { requireScreen } from "@/server/session/require-screen";

import { PayrollScreen } from "./_components/payroll-screen";

export const metadata: Metadata = { title: "Payroll" };

export default async function Page() {
  await requireScreen("payroll");
  return <PayrollScreen />;
}
