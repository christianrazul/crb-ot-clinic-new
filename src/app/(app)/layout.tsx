import { AppShell } from "@/components/app/shell/app-shell";
import { env } from "@/env";
import { getShellSession } from "@/server/session/preview";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getShellSession();

  return (
    <AppShell
      user={session.user}
      branch={session.branch}
      branches={session.branches}
      sidebarCollapsed={session.sidebarCollapsed}
      showRoleSwitcher={env.NEXT_PUBLIC_DEV_ROLE_SWITCHER}
    >
      {children}
    </AppShell>
  );
}
