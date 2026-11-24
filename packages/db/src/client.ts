import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.ts";

export type Db = NodePgDatabase<typeof schema>;

/** One pool per process. `DATABASE_URL` comes from the environment, never from the repository. */
export function createDb(url = process.env.DATABASE_URL): { db: Db; pool: pg.Pool } {
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new pg.Pool({ connectionString: url, max: 5 });
  return { db: drizzle(pool, { schema }), pool };
}
