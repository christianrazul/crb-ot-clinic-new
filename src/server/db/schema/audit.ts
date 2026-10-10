import { bigint, index, jsonb, pgTable, text } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { createdAt } from "./columns";

/** Every create, update and status change on clinical and financial records. Append-only. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    actorUserId: text().references(() => users.id),
    action: text().notNull(),
    entity: text().notNull(),
    entityId: text().notNull(),
    before: jsonb(),
    after: jsonb(),
    ip: text(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.entity, t.entityId), index().on(t.createdAt), index().on(t.actorUserId)],
);
