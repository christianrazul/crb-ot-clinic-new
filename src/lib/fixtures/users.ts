import type { Role } from "@/lib/roles";

export type UserFixture = {
  id: string;
  name: string;
  /** Job title shown under the name in the user menu. */
  title: string;
  role: Role;
};

/** One demo user per role. Replaced by real accounts in Milestone 4. */
export const USERS: Record<Role, UserFixture> = {
  superadmin: {
    id: "usr_owner",
    name: "Camelia Boquia",
    title: "Clinic owner",
    role: "superadmin",
  },
  secretary: { id: "usr_desk", name: "Jo Lauron", title: "Front desk", role: "secretary" },
  therapist: {
    id: "usr_ther_delarosa",
    name: "Jolyn Dela Rosa",
    title: "Occupational Therapist",
    role: "therapist",
  },
};
