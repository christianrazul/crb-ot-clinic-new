import { expect, test as setup } from "@playwright/test";

import { ROLE_EMAILS, storageFor } from "./helpers";
import { SEED_PASSWORD } from "./global-setup";

// Logs in once per role through the login form and saves the session, so
// tests start signed in. (Better Auth's raw sign-in endpoint is disabled.)
for (const [role, email] of Object.entries(ROLE_EMAILS)) {
  setup(`sign in as ${role}`, async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(SEED_PASSWORD);
    await page.getByRole("button", { name: /log in|sign in/i }).click();
    await expect(page).not.toHaveURL(/\/login/);
    await page.context().storageState({ path: storageFor(role as keyof typeof ROLE_EMAILS) });
  });
}
