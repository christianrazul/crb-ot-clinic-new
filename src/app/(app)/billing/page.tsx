import type { Metadata } from "next";

import { requireScreen } from "@/server/session/require-screen";

import { BillingScreen } from "./_components/billing-screen";

export const metadata: Metadata = { title: "Billing and payments" };

export default async function Page() {
  await requireScreen("billing");
  return <BillingScreen />;
}
