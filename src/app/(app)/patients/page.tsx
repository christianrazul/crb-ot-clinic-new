import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/app/page-placeholder";

export const metadata: Metadata = { title: "Patients" };

export default function Page() {
  return <PagePlaceholder screen="patients" />;
}
