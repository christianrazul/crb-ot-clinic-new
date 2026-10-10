import type { Metadata } from "next";

import { PagePlaceholder } from "@/components/app/page-placeholder";

export const metadata: Metadata = { title: "Today" };

export default function Page() {
  return <PagePlaceholder screen="today" />;
}
