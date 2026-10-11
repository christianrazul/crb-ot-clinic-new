import type { Metadata } from "next";

import { loadPayrollPage } from "@/server/loaders/payroll-page";
import { requireScreen } from "@/server/session/require-screen";

import { PayrollScreen } from "./_components/payroll-screen";

export const metadata: Metadata = { title: "Payroll" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const session = await requireScreen("payroll");
  const data = await loadPayrollPage(session, await searchParams);
  return <PayrollScreen data={data} />;
}
