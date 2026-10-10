import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Optimistic route protection: no session cookie, no app pages. This only
 * checks that a cookie exists; every page and Server Action still verifies
 * the session and permissions on the server.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next();
  const login = new URL("/login", request.url);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except auth pages, Better Auth's API, health checks and static files.
  matcher: [
    "/((?!login|forgot-password|reset-password|api/auth|api/health|_next/|favicon.ico|logo.png).*)",
  ],
};
