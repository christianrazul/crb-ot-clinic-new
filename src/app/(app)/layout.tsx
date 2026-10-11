import { AppShell } from "@/components/app/shell/app-shell";
import { env } from "@/env";
import { clinicToday } from "@/server/clock";
import { loadShellData } from "@/server/loaders/shell-data";
import { getShellSession } from "@/server/session/shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getShellSession();
  const shellData = await loadShellData(session);

  return (
    <AppShell
      user={session.user}
      branch={session.branch}
      branches={session.branches}
      sidebarCollapsed={session.sidebarCollapsed}
      showRoleSwitcher={env.NEXT_PUBLIC_DEV_ROLE_SWITCHER && env.NODE_ENV !== "production"}
      today={clinicToday()}
      notifications={shellData.notifications}
    >
      {children}
    </AppShell>
  );
}
