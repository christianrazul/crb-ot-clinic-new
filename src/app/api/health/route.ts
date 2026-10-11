import { databaseIsUp } from "@/server/loaders/health";

export const dynamic = "force-dynamic";

/**
 * Liveness and readiness for Docker and Caddy. Says only whether the app and
 * its database answer; no versions, hosts or errors.
 */
export async function GET() {
  const db = await databaseIsUp();
  return Response.json(
    { status: db ? "ok" : "degraded", db: db ? "ok" : "down" },
    { status: db ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
