import { expect, type Page, test } from "@playwright/test";

const switchBranch = async (page: Page, name: RegExp) => {
  await page.getByRole("button", { name: /CRB OT Clinic/ }).click();
  await page.getByRole("menuitem", { name }).click();
};

test.describe("branch-specific settings", () => {
  test.skip(({ isMobile }) => isMobile, "Writes to the shared database");

  test("a rate saved at Panabo leaves Bangkal's unchanged", async ({ page }) => {
    await page.goto("/settings?tab=rates");
    await expect(page.getByText(/^For CRB Bangkal\./)).toBeVisible();
    const speech = () => page.getByLabel("Speech Therapist rate per session");
    await expect(speech()).toHaveValue("1000");

    await switchBranch(page, /CRB Panabo/);
    await expect(page.getByText(/^For CRB Panabo\./)).toBeVisible();
    await expect(page.getByText(/bills per session at CRB Panabo/)).toBeVisible();
    await speech().fill("1100");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Rates saved")).toBeVisible();
    await page.reload();
    await expect(speech()).toHaveValue("1100");

    await switchBranch(page, /CRB Bangkal/);
    await expect(page.getByText(/^For CRB Bangkal\./)).toBeVisible();
    await expect(speech()).toHaveValue("1000");
  });

  test("a settings page left open on one branch refuses to save after switching in another tab", async ({
    page,
    context,
  }) => {
    await page.goto("/settings?tab=rates");
    await expect(page.getByText(/^For CRB Bangkal\./)).toBeVisible();

    const other = await context.newPage();
    await other.goto("/dashboard");
    await switchBranch(other, /CRB Panabo/);
    await expect(other.getByRole("navigation", { name: "Breadcrumb" })).toContainText("CRB Panabo");

    await page.getByLabel("Speech Therapist therapist share").fill("81");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByText(/You've switched to CRB Panabo since this page loaded/),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByText(/^For CRB Panabo\./)).toBeVisible();
    await expect(page.getByLabel("Speech Therapist therapist share")).toHaveValue("80");
  });

  test("clinic-wide tabs say so", async ({ page }) => {
    await page.goto("/settings?tab=branches");
    await expect(page.getByText("For the whole clinic, across every branch.")).toBeVisible();
  });
});
