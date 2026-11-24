import type { Permission } from "@bakery/core/permissions";

/** The staff app's tabs and the permission each needs; the same map the server enforces (ADR-0015). */
export const TABS = [
  { name: "dnes", titleKey: "tabs.today", permission: "order:view" },
  { name: "nova", titleKey: "tabs.newOrder", permission: "order:create" },
  { name: "plan", titleKey: "tabs.plan", permission: "plan:view" },
  { name: "pozadavky", titleKey: "tabs.requests", permission: "request:view" },
  { name: "nastaveni", titleKey: "tabs.settings", permission: "settings:edit" },
  { name: "provoz", titleKey: "tabs.ops", permission: "ops:view" },
] as const satisfies readonly { name: string; titleKey: string; permission: Permission }[];
