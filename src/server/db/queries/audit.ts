import "server-only";

import type { DbExecutor } from "../client";
import { auditLog } from "../schema";

export type AuditEntry = {
  actorUserId: string | null;
  action: string;
  entity: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
};

/** Records a change. Call inside the same transaction as the change itself. */
export async function writeAudit(db: DbExecutor, entry: AuditEntry) {
  await db.insert(auditLog).values({
    actorUserId: entry.actorUserId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    before: entry.before ?? null,
    after: entry.after ?? null,
    ip: entry.ip ?? null,
  });
}
