import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { branches } from "./clinic";
import { createdAt, id, updatedAt } from "./columns";
import { roleEnum } from "./enums";

/**
 * Better Auth tables (users, sessions, accounts, verifications) with the field
 * names it expects, plus our own role, active flag and lockout counters.
 */
export const users = pgTable("users", {
  id: id(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  role: roleEnum().notNull().default("therapist"),
  active: boolean().notNull().default(true),
  failedLoginCount: integer().notNull().default(0),
  lockedUntil: timestamp({ withTimezone: true, mode: "date" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    expiresAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    token: text().notNull().unique(),
    ipAddress: text(),
    userAgent: text(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true, mode: "date" }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true, mode: "date" }),
    scope: text(),
    /** Password hash, managed by Better Auth. */
    password: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: id(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true, mode: "date" }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.identifier)],
);

/** Better Auth's database-backed rate limiter. */
export const rateLimits = pgTable("rate_limits", {
  id: id(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  // Milliseconds since epoch, too big for a 32-bit integer.
  lastRequest: bigint({ mode: "number" }).notNull(),
});

export const userBranches = pgTable(
  "user_branches",
  {
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    branchId: text()
      .notNull()
      .references(() => branches.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.branchId] }), index().on(t.branchId)],
);
