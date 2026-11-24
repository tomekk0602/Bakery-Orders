/**
 * Roles and permissions of the staff app (ADR-0015). The server enforces them on every staff route;
 * the app uses the same map only to hide what a role cannot use.
 */
export const ROLES = ["owner", "employee"] as const;
export type Role = (typeof ROLES)[number];

/** Resources and their actions, in the shape Better Auth's access control expects. */
export const STATEMENTS = {
  order: ["create", "view", "pickup", "edit", "cancel"],
  plan: ["view"],
  request: ["view", "resolve"],
  settings: ["edit"],
  ops: ["view"],
  demo: ["reset"],
  eval: ["create"],
} as const;

type Statements = typeof STATEMENTS;
export type Permission = { [R in keyof Statements]: `${R}:${Statements[R][number]}` }[keyof Statements];

/** Every permission that exists, for validating what the server sends. */
export const ALL_PERMISSIONS = Object.entries(STATEMENTS).flatMap(([r, actions]) => actions.map((a) => `${r}:${a}`)) as Permission[];

const EMPLOYEE: readonly Permission[] = [
  "order:create",
  "order:view",
  "order:pickup",
  "order:edit",
  "order:cancel",
  "plan:view",
  "request:view",
  "request:resolve",
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  employee: EMPLOYEE,
  owner: [...EMPLOYEE, "settings:edit", "ops:view", "demo:reset", "eval:create"],
};

export const isRole = (value: unknown): value is Role => typeof value === "string" && (ROLES as readonly string[]).includes(value);

/** Whether a role holds a permission. An unknown or missing role holds none. */
export function can(role: unknown, permission: Permission): boolean {
  return isRole(role) && ROLE_PERMISSIONS[role].includes(permission);
}

/** The permissions of a role grouped by resource, for Better Auth's `ac.newRole`. */
export type RoleStatements = { [R in keyof Statements]?: Statements[R][number][] };

export function statementsOf(role: Role): RoleStatements {
  const out: Record<string, string[]> = {};
  for (const p of ROLE_PERMISSIONS[role]) {
    const [resource, action] = p.split(":") as [string, string];
    (out[resource] ??= []).push(action);
  }
  // Every entry comes from a typed Permission, so the actions belong to their resource.
  return out as RoleStatements;
}
