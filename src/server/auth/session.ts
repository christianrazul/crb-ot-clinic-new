import "server-only";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { isRole } from "@/lib/roles";
import { getDb } from "@/server/db/client";
import { branchesForUser } from "@/server/db/queries/branches";
import { rateClasses, staff, users } from "@/server/db/schema";

import type { Actor } from "./actor";
import { auth } from "./auth";
import { ROLE_TITLES } from "./permissions";

/**
 * The signed-in actor for this request, or null. Cached per request. Inactive
 * or locked users have no actor even if a session cookie survives.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return null;

  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, session.user.id), eq(users.active, true)));
  if (!user || !isRole(user.role)) return null;

  const [linkedStaff] = await db
    .select({ id: staff.id, rateClassName: rateClasses.name })
    .from(staff)
    .innerJoin(rateClasses, eq(staff.rateClassId, rateClasses.id))
    .where(eq(staff.userId, user.id));
  const branches = await branchesForUser(db, user.id);

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    branchIds: branches.map((b) => b.id),
    staffId: linkedStaff?.id ?? null,
    title:
      linkedStaff && user.role === "therapist" ? linkedStaff.rateClassName : ROLE_TITLES[user.role],
    ip:
      requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      requestHeaders.get("x-real-ip"),
  };
});

/** For pages: the actor, or a redirect to the login page. */
export async function requireActor(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  return actor;
}
