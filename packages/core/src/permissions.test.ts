import { describe, expect, it } from "vitest";
import { can, ROLE_PERMISSIONS, statementsOf, STATEMENTS } from "./permissions.ts";

describe("permissions", () => {
  it("lets an employee take orders and read the plan", () => {
    for (const p of ["order:create", "order:pickup", "plan:view", "request:resolve"] as const)
      expect(can("employee", p)).toBe(true);
  });

  it("keeps settings, ops, demo reset and eval cases for the owner (FR-044)", () => {
    for (const p of ["settings:edit", "ops:view", "demo:reset", "eval:create"] as const) {
      expect(can("employee", p)).toBe(false);
      expect(can("owner", p)).toBe(true);
    }
  });

  it("gives nothing to an unknown or missing role", () => {
    expect(can("admin", "order:view")).toBe(false);
    expect(can(undefined, "order:view")).toBe(false);
  });

  it("an owner can do everything an employee can", () => {
    for (const p of ROLE_PERMISSIONS.employee) expect(can("owner", p)).toBe(true);
  });

  it("every permission belongs to a declared resource and action", () => {
    for (const role of ["owner", "employee"] as const)
      for (const [resource, actions] of Object.entries(statementsOf(role)))
        for (const a of actions) expect(STATEMENTS[resource as keyof typeof STATEMENTS]).toContain(a);
  });
});
