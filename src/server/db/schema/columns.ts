import { text, timestamp } from "drizzle-orm/pg-core";

/** Text primary key. The app supplies readable ids for seed data; new rows get a UUID. */
export const id = () =>
  text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

export const createdAt = () =>
  timestamp({ withTimezone: true, mode: "date" }).notNull().defaultNow();

export const updatedAt = () =>
  timestamp({ withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdateFn(() => new Date());
