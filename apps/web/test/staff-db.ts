import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { Role } from "@bakery/core";

/**
 * A real PostgreSQL for route tests: migrated, seeded, with one owner and one employee signed in.
 * DATABASE_URL is set before the app modules load, so the routes use this database.
 */
export async function startStaffDb() {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer("postgres:17").start();
  process.env.DATABASE_URL = container.getConnectionUri();
  const { db } = await import("@/server/runtime");
  const { auth } = await import("@/server/auth");
  const { seedBakery } = await import("@bakery/db");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  await migrate(db(), { migrationsFolder: new URL("../../../packages/db/migrations", import.meta.url).pathname });
  await seedBakery(db());

  const cookies = {} as Record<Role, string>;
  for (const role of ["owner", "employee"] as const) {
    const email = `${role}@test.local`;
    await auth().api.createUser({ body: { email, password: "test-password-1", name: role, role } });
    const res = await auth().api.signInEmail({ body: { email, password: "test-password-1" }, asResponse: true });
    cookies[role] = (res.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
  }
  // The pool is closed first: idle connections cut by the stopping container report FATAL 57P01.
  const stop = async () => {
    await db().$client.end();
    await container.stop();
  };
  return { cookies, stop };
}

export const request = (path: string, init: RequestInit & { cookie?: string } = {}) =>
  new Request(`http://localhost:3000${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init.cookie ? { cookie: init.cookie } : {}) },
  });
