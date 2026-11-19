import type { Metadata } from "next";

import { loadBillingPage } from "@/server/loaders/billing-page";
import { requireScreen } from "@/server/session/require-screen";

import { BillingScreen } from "./_components/billing-screen";

export const metadata: Metadata = { title: "Billing and payments" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[]>>;
}) {
  const session = await requireScreen("billing");
  const data = await loadBillingPage(session, await searchParams);
  return <BillingScreen data={data} branchName={session.branch.name} />;
}
