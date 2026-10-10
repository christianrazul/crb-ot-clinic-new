import type { Role } from "@/lib/roles";

/**
 * The signed-in person, as every service sees them. Built on the server from
 * the session and the database, never from anything the client sends.
 */
export type Actor = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  /** Branches this person may work in. */
  branchIds: string[];
  /** The linked staff record, for therapists (and any staff with a login). */
  staffId: string | null;
  /** Job title for the user menu, e.g. "Front desk". */
  title: string;
  ip: string | null;
};
