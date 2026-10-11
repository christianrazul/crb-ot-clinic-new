import "server-only";

import { and, asc, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";

import type { Actor } from "@/server/auth/actor";
import { assertCan } from "@/server/auth/permissions";
import type { DbExecutor } from "@/server/db/client";
import { auditLog, users } from "@/server/db/schema";

const PAGE_SIZE = 50;

const auditQuery = z.object({
  entity: z.string().max(40).optional(),
  /** Keyset paging: rows older than this id. */
  beforeId: z.number().int().positive().optional(),
});

/** The audit trail, newest first, 50 at a time. Owner only. The log itself is append-only. */
export async function listAuditLog(db: DbExecutor, actor: Actor, raw: unknown) {
  assertCan(actor, "audit:read");
  const query = auditQuery.parse(raw ?? {});
  const rows = await db
    .select({
      id: auditLog.id,
      createdAt: auditLog.createdAt,
      action: auditLog.action,
      entity: auditLog.entity,
      entityId: auditLog.entityId,
      before: auditLog.before,
      after: auditLog.after,
      ip: auditLog.ip,
      actorName: users.name,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorUserId, users.id))
    .where(
      and(
        query.entity ? eq(auditLog.entity, query.entity) : undefined,
        query.beforeId ? lt(auditLog.id, query.beforeId) : undefined,
      ),
    )
    .orderBy(desc(auditLog.id))
    .limit(PAGE_SIZE + 1);
  const page = rows.slice(0, PAGE_SIZE);
  return {
    rows: page.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
      actorName: r.actorName ?? "System",
    })),
    nextBeforeId: rows.length > PAGE_SIZE ? page.at(-1)!.id : null,
  };
}
export type AuditPage = Awaited<ReturnType<typeof listAuditLog>>;

/** The kinds of record that have entries, for the filter. */
export async function auditEntities(db: DbExecutor, actor: Actor) {
  assertCan(actor, "audit:read");
  const rows = await db
    .selectDistinct({ entity: auditLog.entity })
    .from(auditLog)
    .orderBy(asc(auditLog.entity));
  return rows.map((r) => r.entity);
}
