import type { Role } from "@/lib/roles";

export const ROLE_EMAILS: Record<Role, string> = {
  superadmin: "camelia@crbclinic.test",
  secretary: "jo@crbclinic.test",
  therapist: "jolyn@crbclinic.test",
};

/** Saved session for a role, created by auth.setup.ts. Use with test.use({ storageState }). */
export const storageFor = (role: Role) => `tests/e2e/.auth/${role}.json`;

export const isMobileProject = (name: string) => name === "mobile";

/** The newest email the test server sent to `to`, waiting briefly for it. */
export async function lastEmailTo(to: string) {
  const { readFileSync } = await import("node:fs");
  const { E2E_OUTBOX } = await import("../../playwright.config");
  for (let i = 0; i < 20; i++) {
    const emails = readFileSync(E2E_OUTBOX, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { to: string; subject: string; text: string })
      .filter((email) => email.to === to);
    if (emails.length) return emails.at(-1)!;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No email to ${to} in the outbox.`);
}
