import { expect, test } from "@playwright/test";

test("home redirects to the role home without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/");

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Good morning, Camelia" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
