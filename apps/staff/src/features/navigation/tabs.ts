import type { Permission } from "@bakery/core/permissions";

/** The staff app's tabs and the permission each needs; the same map the server enforces (ADR-0015). */
export const TABS = [
  { name: "dnes", icon: "📋", titleKey: "tabs.today", permission: "order:view" },
  { name: "nova", icon: "➕", titleKey: "tabs.newOrder", permission: "order:create" },
  { name: "plan", icon: "🥖", titleKey: "tabs.plan", permission: "plan:view" },
  { name: "pozadavky", icon: "📞", titleKey: "tabs.requests", permission: "request:view" },
  { name: "nastaveni", icon: "⚙️", titleKey: "tabs.settings", permission: "settings:edit" },
  { name: "provoz", icon: "📊", titleKey: "tabs.ops", permission: "ops:view" },
] as const satisfies readonly { name: string; icon: string; titleKey: string; permission: Permission }[];
