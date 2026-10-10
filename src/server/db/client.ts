import "server-only";

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;
/** A database handle or an open transaction; query functions accept either. */
export type DbExecutor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Creates a Drizzle client. The app uses `db` below; scripts and tests create their own. */
export function createDb(url: string, options: { max?: number } = {}) {
  const client = postgres(url, { max: options.max ?? 10, onnotice: () => {} });
  return { db: drizzle(client, { schema, casing: "snake_case" }), client };
}

const globalForDb = globalThis as unknown as { crbDb?: Database };

/** Lazily connects on first use, so importing this module never needs a database. */
export function getDb(): Database {
  if (!globalForDb.crbDb) {
    // Imported here, not at the top, so scripts and tests that pass their own
    // URL never trigger env validation for the web app.
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
    globalForDb.crbDb = createDb(url).db;
  }
  return globalForDb.crbDb;
}
