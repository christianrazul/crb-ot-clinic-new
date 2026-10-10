import { redirect } from "next/navigation";

import { ROLE_HOME } from "@/components/app/shell/nav";
import { getShellSession } from "@/server/session/preview";

export default async function HomePage() {
  const { user } = await getShellSession();
  redirect(ROLE_HOME[user.role]);
}
