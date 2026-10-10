import type { Actor } from "@/server/auth/actor";

/** Actors matching the seeded accounts, for service and permission tests. */
export const ACTORS = {
  owner: {
    userId: "usr_owner",
    name: "Camelia Boquia",
    email: "camelia@crbclinic.test",
    role: "superadmin",
    branchIds: ["br_bangkal", "br_panabo"],
    staffId: null,
    title: "Clinic owner",
    ip: null,
  },
  desk: {
    userId: "usr_desk",
    name: "Jo Lauron",
    email: "jo@crbclinic.test",
    role: "secretary",
    branchIds: ["br_bangkal"],
    staffId: null,
    title: "Front desk",
    ip: null,
  },
  therapist: {
    userId: "usr_ther_delarosa",
    name: "Jolyn Dela Rosa",
    email: "jolyn@crbclinic.test",
    role: "therapist",
    branchIds: ["br_bangkal"],
    staffId: "stf_delarosa",
    title: "Occupational Therapist",
    ip: null,
  },
} satisfies Record<string, Actor>;
