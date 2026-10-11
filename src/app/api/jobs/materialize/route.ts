import { timingSafeEqual } from "node:crypto";

import { env } from "@/env";
import { runMaterializeJob } from "@/server/jobs/materialize";

/**
 * Daily job: keeps recurring series materialized 8 weeks ahead. Call it from
 * cron with `Authorization: Bearer $CRON_SECRET` (see docs/deploy.md).
 */
export async function POST(request: Request) {
  const secret = env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const ok =
    secret &&
    given.length === secret.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(secret));
  if (!ok) return Response.json({ error: "Not allowed." }, { status: 401 });
  const result = await runMaterializeJob();
  return Response.json(result);
}
