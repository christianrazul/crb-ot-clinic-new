import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

import { storageFor } from "./helpers";

const SCREENS = {
  superadmin: [
    "/dashboard",
    "/schedule",
    "/patients",
    "/billing",
    "/payroll",
    "/settings",
    "/settings?tab=team",
  ],
  secretary: ["/today", "/schedule?view=week", "/patients?patient=pat_01", "/billing"],
  therapist: ["/my-day", "/schedule", "/patients"],
} as const;

/** WCAG 2.1 A and AA rules. Every screen, light and dark. */
const scan = (page: Page) =>
  new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();

const summary = (violations: Awaited<ReturnType<typeof scan>>["violations"]) =>
  violations.map(
    (v) =>
      `${v.id}: ${v.nodes.map((n) => `${n.target.join(" ")} [${n.html.slice(0, 160)}] ${n.failureSummary?.split("\n")[1] ?? ""}`).join(" | ")}`,
  );

test.describe("accessibility", () => {
  test.skip(({ isMobile }) => isMobile, "Same markup as desktop");

  test("login page has no violations", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto("/login");
    expect(summary((await scan(page)).violations)).toEqual([]);
    await context.close();
  });

  for (const [role, paths] of Object.entries(SCREENS)) {
    for (const scheme of ["light", "dark"] as const) {
      test.describe(`${role}, ${scheme}`, () => {
        test.use({ storageState: storageFor(role as keyof typeof SCREENS), colorScheme: scheme });

        test(`${role} screens have no violations in ${scheme} mode`, async ({ page }) => {
          await page.addInitScript((theme) => {
            localStorage.setItem("crb-theme", theme);
          }, scheme);
          for (const path of paths) {
            await page.goto(path);
            await page.waitForLoadState("networkidle");
            expect(summary((await scan(page)).violations), path).toEqual([]);
          }
        });
      });
    }
  }
});
