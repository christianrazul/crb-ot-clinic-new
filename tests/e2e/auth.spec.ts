import { expect, test } from "@playwright/test";

import { SEED_PASSWORD } from "./global-setup";
import { ROLE_EMAILS, storageFor } from "./helpers";

test.describe("signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("app pages send you to the login page", async ({ page }) => {
    for (const path of ["/dashboard", "/billing", "/patients?patient=pat_01"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
  });

  test("logs in with email and password and lands on the role home", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ROLE_EMAILS.secretary);
    await page.getByLabel("Password").fill(SEED_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/today$/);
    await expect(page.getByRole("heading", { level: 1, name: "Good morning, Jo" })).toBeVisible();
  });

  test("a wrong password shows a message that does not reveal the account", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ROLE_EMAILS.therapist);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText(
      /That email and password don't match/,
    );

    await page.getByLabel("Email").fill("nobody@crbclinic.test");
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText(
      /That email and password don't match/,
    );
  });

  test("forgot password gives the same answer for any email", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByLabel("Email").fill("nobody@crbclinic.test");
    await page.getByRole("button", { name: "Email reset link" }).click();
    await expect(page.getByRole("status")).toHaveText(/If that email has an account/);
  });

  test("Better Auth's sign-up endpoint is closed", async ({ request }) => {
    const response = await request.post("/api/auth/sign-up/email", {
      data: { email: "intruder@example.test", password: "a-long-password-123", name: "Intruder" },
    });
    expect(response.ok()).toBe(false);
  });
});

test.describe("logging out", () => {
  // A fresh session, so logging out does not end the shared one.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("ends the session", async ({ page }, testInfo) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(ROLE_EMAILS.superadmin);
    await page.getByLabel("Password").fill(SEED_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // On phones the account menu lives in the sidebar sheet.
    if (testInfo.project.name === "mobile")
      await page.getByRole("button", { name: "Toggle sidebar" }).click();
    await page.getByRole("button", { name: /Camelia Boquia|Account menu/ }).click();
    await page.getByRole("menuitem", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("therapist", () => {
  test.use({ storageState: storageFor("therapist") });

  test("cannot open billing even by URL", async ({ page }) => {
    await page.goto("/billing");
    await expect(page).toHaveURL(/\/my-day$/);
  });
});
