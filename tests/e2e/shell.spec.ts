import { expect, test } from "@playwright/test";

import { isMobileProject, storageFor } from "./helpers";

const NAV_BY_ROLE = {
  superadmin: ["Dashboard", "Schedule", "Patients", "Billing & payments", "Payroll", "Settings"],
  secretary: ["Today", "Schedule", "Patients", "Billing & payments"],
  therapist: ["My day", "My schedule", "My patients"],
} as const;

const HOME_BY_ROLE = { superadmin: "/dashboard", secretary: "/today", therapist: "/my-day" };

for (const role of ["superadmin", "secretary", "therapist"] as const) {
  test.describe(`navigation for ${role}`, () => {
    test.use({ storageState: storageFor(role) });

    test(`${role} sees only their navigation`, async ({ page }, testInfo) => {
      await page.goto("/");
      await expect(page).toHaveURL(new RegExp(`${HOME_BY_ROLE[role]}$`));

      if (isMobileProject(testInfo.project.name)) {
        await page.getByRole("button", { name: "Toggle sidebar" }).click();
      }
      const nav = page.getByRole(
        isMobileProject(testInfo.project.name) ? "dialog" : "complementary",
      );
      await expect(nav.getByRole("navigation").getByRole("link")).toHaveText([
        ...NAV_BY_ROLE[role],
      ]);
    });
  });
}

test.describe("therapist routing", () => {
  test.use({ storageState: storageFor("therapist") });

  test("therapists are sent home from screens outside their navigation", async ({ page }) => {
    await page.goto("/payroll");
    await expect(page).toHaveURL(/\/my-day$/);
  });

  test("therapists never get New session", async ({ page }) => {
    await page.goto("/schedule");
    await expect(page.getByRole("heading", { level: 1 })).toBeAttached();
    await expect(page.getByRole("button", { name: "New session" })).toHaveCount(0);
  });
});

test.describe("front desk header", () => {
  test.use({ storageState: storageFor("secretary") });

  test("New session shows on booking screens only", async ({ page }) => {
    await page.goto("/today");
    await expect(page.getByRole("button", { name: "New session" })).toBeVisible();
    await page.goto("/billing");
    await expect(page.getByRole("heading", { level: 1 })).toBeAttached();
    await expect(page.getByRole("button", { name: "New session" })).toHaveCount(0);
  });
});

test.describe("theme", () => {
  test("choice persists across reloads and is applied before the page renders", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.getByRole("button", { name: "Change theme" }).click();
    await page.getByRole("menuitem", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    // Record the theme at the first point scripts can observe the document, before
    // React hydrates. If it is already dark here, there is no light flash.
    await page.addInitScript(() => {
      document.addEventListener("DOMContentLoaded", () => {
        (window as unknown as { themeAtParse: string | undefined }).themeAtParse =
          document.documentElement.dataset.theme;
      });
    });
    await page.reload();
    const themeAtParse = await page.evaluate(
      () => (window as unknown as { themeAtParse: string | undefined }).themeAtParse,
    );
    expect(themeAtParse).toBe("dark");
  });

  test("system follows the operating system setting", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Change theme" }).click();
    await page.getByRole("menuitem", { name: "System" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });
});

test.describe("desktop shell", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop only");

  test("Ctrl+B collapses the sidebar and the state survives a reload", async ({ page }) => {
    await page.goto("/dashboard");
    const sidebar = page.getByRole("complementary", { name: "Main navigation" });
    await expect(sidebar).toHaveCSS("width", "256px");

    await page.keyboard.press("Control+b");
    await expect(sidebar).toHaveCSS("width", "56px");
    // Collapsed links keep an accessible name through aria-label.
    await expect(sidebar.getByRole("link", { name: "Payroll" })).toBeVisible();

    await page.reload();
    await expect(sidebar).toHaveCSS("width", "56px");

    await page.getByRole("button", { name: "Toggle sidebar" }).click();
    await expect(sidebar).toHaveCSS("width", "256px");
  });

  test("Ctrl+K opens the command palette and Enter opens a page", async ({ page }) => {
    await page.goto("/dashboard");
    await page.keyboard.press("Control+k");
    const palette = page.getByRole("dialog");
    await expect(palette.getByPlaceholder("Search patients, pages, actions…")).toBeFocused();

    await page.keyboard.type("payroll");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/payroll$/);
    await expect(palette).toBeHidden();
  });

  test("the palette lists patients, pages and actions", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Search patients…" }).click();
    const palette = page.getByRole("dialog");
    await expect(palette.locator("[cmdk-group-heading]")).toHaveText([
      "Patients",
      "Go to",
      "Actions",
    ]);

    await page.keyboard.type("Liam");
    // Results come from the server; wait for them as a person would.
    await expect(palette.getByRole("option", { name: /Liam Santos/ })).toBeVisible();
    await page.keyboard.press("Enter");
    // Links carry the patient id, never the name.
    await expect(page).toHaveURL(/\/patients\?patient=pat_01$/);
  });

  test("switching branch updates the breadcrumb", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("CRB Bangkal");

    await page.getByRole("button", { name: /CRB OT Clinic/ }).click();
    await page.getByRole("menuitem", { name: /CRB Panabo/ }).click();
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toContainText("CRB Panabo");
  });
});

test.describe("mobile shell", () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test("no horizontal page scroll at 360px and the sidebar is a sheet", async ({ page }) => {
    await page.goto("/dashboard");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    await expect(page.getByRole("complementary", { name: "Main navigation" })).toBeHidden();

    await page.getByRole("button", { name: "Toggle sidebar" }).click();
    const sheet = page.getByRole("dialog", { name: "Navigation" });
    await expect(sheet).toBeVisible();

    await sheet.getByRole("link", { name: "Patients" }).click();
    await expect(page).toHaveURL(/\/patients$/);
    await expect(sheet).toBeHidden();
  });
});

test("every button has an accessible name", async ({ page }) => {
  await page.goto("/dashboard");
  const unnamed = await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .filter((button) => button.offsetParent !== null)
      .filter((button) => !(button.getAttribute("aria-label") || button.textContent?.trim()))
      .map((button) => button.outerHTML.slice(0, 120)),
  );
  expect(unnamed).toEqual([]);
});
