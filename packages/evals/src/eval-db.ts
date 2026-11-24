import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { createDb, loadBakery, seedBakery } from "@bakery/db";
import { migrate } from "drizzle-orm/node-postgres/migrator";

/**
 * "Now" for every eval: Tuesday 24 November 2026, 9:00 in Prague, so "zítra" and "v sobotu" have one
 * right answer and the cut-off (14:00 the day before) never refuses tomorrow.
 */
export const EVAL_NOW = new Date("2026-11-24T08:00:00Z");

/** A seeded PostgreSQL in a container — the same migrations and seed as production, nothing shared. */
export async function startEvalDb() {
  const container = await new PostgreSqlContainer("postgres:17").start();
  const { db, pool } = createDb(container.getConnectionUri());
  await migrate(db, { migrationsFolder: new URL("../../db/migrations", import.meta.url).pathname });
  await seedBakery(db);
  const bakery = await loadBakery(db);
  return {
    db,
    bakery,
    stop: async () => {
      await pool.end();
      await container.stop();
    },
  };
}

export type EvalDb = Awaited<ReturnType<typeof startEvalDb>>;
