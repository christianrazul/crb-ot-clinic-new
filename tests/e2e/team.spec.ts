import { expect, test } from "@playwright/test";

import { lastEmailTo } from "./helpers";

test.describe("onboarding a secretary", () => {
  test.skip(({ isMobile }) => isMobile, "Writes to the shared database");

  test("the owner invites them, they set a password, sign in to Today, and can be turned off", async ({
    page,
    browser,
  }) => {
    const email = `rita.${Date.now()}@example.test`;

    // The owner sends the invite.
    await page.goto("/settings?tab=team");
    await page.getByRole("button", { name: "Add account" }).click();
    const dialog = page.getByRole("dialog", { name: "Add an account" });
    await expect(dialog.getByText(/Today's queue, the schedule, patients/)).toBeVisible();
    await dialog.getByLabel("Full name").fill("Rita Cruz");
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByText("Invite sent to Rita Cruz")).toBeVisible();
    const row = page.getByRole("row", { name: new RegExp(email) });
    await expect(row.getByText("Invited")).toBeVisible();
    await expect(row.getByText("Front desk")).toBeVisible();

    // The secretary follows the emailed link in their own browser.
    const invite = await lastEmailTo(email);
    expect(invite.subject).toBe("You're invited to CRB OT Clinic");
    const link = invite.text.match(/https?:\/\/\S+\/reset-password\?\S+/)![0];
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const rita = await context.newPage();
    await rita.goto(new URL(link).pathname + new URL(link).search);
    await expect(
      rita.getByRole("heading", { name: "Welcome to CRB OT Clinic, Rita" }),
    ).toBeVisible();
    await expect(rita.getByText(/added as Front desk at CRB Bangkal/)).toBeVisible();
    await rita.getByLabel("New password", { exact: true }).fill("a-secretary-password-123");
    await rita.getByLabel("Repeat new password").fill("a-secretary-password-123");
    await rita.getByRole("button", { name: "Set password" }).click();
    await expect(rita.getByText("Your password is set. Log in to get started.")).toBeVisible();

    await rita.getByLabel("Email").fill(email);
    await rita.getByLabel("Password", { exact: true }).fill("a-secretary-password-123");
    await rita.getByRole("button", { name: /log in/i }).click();
    await expect(rita).toHaveURL(/\/today$/);
    const nav = rita.getByRole("navigation").first();
    await expect(nav.getByRole("link", { name: "Billing & payments" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Payroll" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Settings" })).toHaveCount(0);

    // The link works only once.
    await context.clearCookies();
    await rita.goto(new URL(link).pathname + new URL(link).search);
    await expect(rita.getByRole("heading", { name: "This invite has expired" })).toBeVisible();
    await rita.goto("/login");
    await rita.getByLabel("Email").fill(email);
    await rita.getByLabel("Password", { exact: true }).fill("a-secretary-password-123");
    await rita.getByRole("button", { name: /log in/i }).click();
    await expect(rita).toHaveURL(/\/today$/);

    // Back with the owner: now active. Turning the account off signs Rita out.
    await page.reload();
    await expect(row.getByText("Active")).toBeVisible();
    await row.getByRole("button", { name: "Actions for Rita Cruz" }).click();
    await page.getByRole("menuitem", { name: "Turn off" }).click();
    await expect(page.getByText("Rita Cruz is signed out and can't sign in")).toBeVisible();
    await expect(row.getByText("Turned off")).toBeVisible();
    await rita.goto("/today");
    await expect(rita).toHaveURL(/\/login/);
    await context.close();
  });

  test("an unknown invite link explains what to do", async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();
    await page.goto("/reset-password?token=not-a-real-token&invite=1");
    await expect(page.getByRole("heading", { name: "This invite has expired" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Email me a new link" })).toBeVisible();
    await context.close();
  });
});

test.describe("giving a staff member a login", () => {
  test.skip(({ isMobile }) => isMobile, "Writes to the shared database");

  test("the owner picks the staff member and an invite goes out", async ({ page }) => {
    const email = `marco.${Date.now()}@example.test`;
    await page.goto("/settings?tab=team");
    await page.getByRole("button", { name: "Add account" }).click();
    const dialog = page.getByRole("dialog", { name: "Add an account" });
    await dialog.getByLabel("Access").click();
    await page.getByRole("option", { name: /Therapist login for Marco Tan/ }).click();
    await expect(dialog.getByLabel("Full name")).toHaveValue("Marco Tan");
    await dialog.getByLabel("Email").fill(email);
    await dialog.getByRole("button", { name: "Send invite" }).click();
    await expect(page.getByText("Invite sent to Marco Tan")).toBeVisible();
    const row = page.getByRole("row", { name: new RegExp(email) });
    await expect(row.getByText("Therapist")).toBeVisible();
    expect((await lastEmailTo(email)).text).toContain("as Therapist at CRB Bangkal");
  });
});
