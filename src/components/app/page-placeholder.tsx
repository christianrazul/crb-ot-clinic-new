import { redirect } from "next/navigation";

import { canSeeScreen, ROLE_HOME, SCREEN_TITLES, type ScreenKey } from "@/components/app/shell/nav";
import { getShellSession } from "@/server/session/preview";

/**
 * Empty screen used by every route in Milestone 1. Redirects roles that do not
 * have the screen in their navigation. This is a UI convenience only; real
 * authorization checks arrive with Better Auth in Milestone 4.
 */
export async function PagePlaceholder({ screen }: { screen: ScreenKey }) {
  const { user } = await getShellSession();
  if (!canSeeScreen(user.role, screen)) redirect(ROLE_HOME[user.role]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{SCREEN_TITLES[screen]}</h1>
        <p className="mt-1 text-sm text-muted-foreground">This screen is built in Milestone 2.</p>
      </div>
    </div>
  );
}
