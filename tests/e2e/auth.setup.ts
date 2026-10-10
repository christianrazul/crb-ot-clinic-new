import { expect, test as setup } from "@playwright/test";

import { ROLE_EMAILS, storageFor } from "./helpers";
import { SEED_PASSWORD } from "./global-setup";

// Logs in once per role through Better Auth's API and saves the session, so
// tests start signed in without going through the form each time.
for (const [role, email] of Object.entries(ROLE_EMAILS)) {
  setup(`sign in as ${role}`, async ({ request }) => {
    const response = await request.post("/api/auth/sign-in/email", {
      data: { email, password: SEED_PASSWORD },
    });
    expect(response.ok()).toBe(true);
    await request.storageState({ path: storageFor(role as keyof typeof ROLE_EMAILS) });
  });
}
