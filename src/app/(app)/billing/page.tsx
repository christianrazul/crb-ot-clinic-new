import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/app/page-placeholder";

export const metadata: Metadata = { title: "Billing & payments" };

export default function Page() {
  return <PagePlaceholder screen="billing" />;
}
