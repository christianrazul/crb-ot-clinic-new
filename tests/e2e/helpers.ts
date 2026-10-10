import type { BrowserContext } from "@playwright/test";

import type { Role } from "@/lib/roles";

/** Sets the previewed role before the first request, so tests can run in parallel. */
export async function previewAs(context: BrowserContext, baseURL: string, role: Role) {
  await context.addCookies([{ name: "crb-preview-role", value: role, url: baseURL }]);
}

export const isMobileProject = (name: string) => name === "mobile";
