import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/** Pages and endpoints reachable without a session cookie. */
const PUBLIC_PATHS =
  /^\/(login|forgot-password|reset-password|api\/auth|api\/health|api\/jobs)(\/|$)/;

/**
 * Strict CSP: scripts only with this request's nonce (Next.js adds it to its
 * own scripts; next-themes gets it from the root layout). Styles allow inline
 * attributes because Radix and Recharts position elements with style="".
 */
export function contentSecurityPolicy(nonce: string, options: { dev: boolean; https: boolean }) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${options.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(options.https ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

/**
 * Runs before every page and API request. Sets the CSP with a fresh nonce,
 * then does optimistic route protection: no session cookie, no app pages.
 * The cookie check is only a redirect; every page and Server Action still
 * verifies the session and permissions on the server.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!PUBLIC_PATHS.test(pathname) && !getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce, {
    dev: process.env.NODE_ENV === "development",
    https: (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://"),
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Everything except build assets and public files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|robots.txt).*)"],
};
