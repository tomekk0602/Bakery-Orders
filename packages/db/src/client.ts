import { drizzle, type NodePgDatabase, type NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
import pg from "pg";
import * as schema from "./schema.ts";

/** The pool stays reachable as `$client`, so a process (or a test) can close it. */
export type Db = NodePgDatabase<typeof schema> & { $client: pg.Pool };

/** The pool or a transaction on it: for work that must also run inside a larger transaction. */
export type Executor = PgDatabase<NodePgQueryResultHKT, typeof schema>;

/** One pool per process. `DATABASE_URL` comes from the environment, never from the repository. */
export function createDb(url = process.env.DATABASE_URL): { db: Db; pool: pg.Pool } {
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new pg.Pool({ connectionString: url, max: 5 });
  return { db: drizzle(pool, { schema }), pool };
}
