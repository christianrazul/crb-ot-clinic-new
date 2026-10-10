import type { Role } from "@/lib/roles";

export const ROLE_EMAILS: Record<Role, string> = {
  superadmin: "camelia@crbclinic.test",
  secretary: "jo@crbclinic.test",
  therapist: "jolyn@crbclinic.test",
};

/** Saved session for a role, created by auth.setup.ts. Use with test.use({ storageState }). */
export const storageFor = (role: Role) => `tests/e2e/.auth/${role}.json`;

export const isMobileProject = (name: string) => name === "mobile";
