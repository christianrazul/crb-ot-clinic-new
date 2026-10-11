import type { Metadata } from "next";

import { loadBillingPage } from "@/server/loaders/billing-page";
import { requireScreen } from "@/server/session/require-screen";

import { BillingScreen } from "./_components/billing-screen";

export const metadata: Metadata = { title: "Billing and payments" };

export default async function Page() {
  const session = await requireScreen("billing");
  const data = await loadBillingPage(session);
  return <BillingScreen data={data} branchName={session.branch.name} />;
}
