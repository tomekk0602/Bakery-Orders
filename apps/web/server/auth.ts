import "server-only";
import { can, ROLES, STATEMENTS, statementsOf, type Permission, type Role } from "@bakery/core";
import * as schema from "@bakery/db";
import { expo } from "@better-auth/expo";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { TRUSTED_ORIGINS } from "./origins";
import { db, fail, required } from "./runtime";

// Access control built from the one permission map in the core (ADR-0015).
const ac = createAccessControl(STATEMENTS);
const roles = Object.fromEntries(ROLES.map((r) => [r, ac.newRole(statementsOf(r))])) as Record<
  Role,
  ReturnType<typeof ac.newRole>
>;

function createAuth() {
  return betterAuth({
    secret: required("BETTER_AUTH_SECRET", "development-only-secret-at-least-32-characters"),
    baseURL: required("BETTER_AUTH_URL", "http://localhost:3000"),
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: { enabled: true, disableSignUp: true },
    trustedOrigins: TRUSTED_ORIGINS,
    plugins: [expo(), admin({ ac, roles, defaultRole: "employee", adminRoles: ["owner"] })],
  });
}

const g = globalThis as unknown as { __bakeryAuth?: ReturnType<typeof createAuth> };
export const auth = (): ReturnType<typeof createAuth> => (g.__bakeryAuth ??= createAuth());

export type StaffUser = { id: string; name: string; email: string; role: Role };

/**
 * The signed-in staff member if they hold `permission` — else the 401/403 response to return
 * (FR-043). Every staff route calls this first.
 */
export async function requirePermission(
  req: Request,
  permission: Permission,
): Promise<{ user: StaffUser } | { response: Response }> {
  const session = await auth().api.getSession({ headers: req.headers });
  if (!session) return { response: fail("unauthenticated", "Přihlaste se prosím.", 401) };
  const role = session.user.role;
  if (!can(role, permission)) return { response: fail("forbidden", "K této akci nemáte oprávnění.", 403) };
  return { user: { id: session.user.id, name: session.user.name, email: session.user.email, role: role as Role } };
}
