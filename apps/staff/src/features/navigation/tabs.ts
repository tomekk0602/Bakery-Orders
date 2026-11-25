import type Ionicons from "@expo/vector-icons/Ionicons";
import type { Permission } from "@bakery/core/permissions";

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * The staff app's tabs and the permission each needs; the same map the server enforces (ADR-0015).
 * Icons: filled when the tab is selected, outlined otherwise; the label in the bar may be shorter than
 * the page title (FR-075, research R42).
 */
export const TABS = [
  { name: "dnes", icon: "clipboard", titleKey: "tabs.today", labelKey: "tabs.today", permission: "order:view" },
  {
    name: "nova",
    icon: "add-circle",
    titleKey: "tabs.newOrder",
    labelKey: "tabs.newOrderShort",
    permission: "order:create",
  },
  { name: "plan", icon: "calendar", titleKey: "tabs.plan", labelKey: "tabs.plan", permission: "plan:view" },
  { name: "pozadavky", icon: "call", titleKey: "tabs.requests", labelKey: "tabs.requests", permission: "request:view" },
  {
    name: "nastaveni",
    icon: "settings",
    titleKey: "tabs.settings",
    labelKey: "tabs.settings",
    permission: "settings:edit",
  },
  { name: "provoz", icon: "stats-chart", titleKey: "tabs.ops", labelKey: "tabs.ops", permission: "ops:view" },
] as const satisfies readonly {
  name: string;
  icon: IconName;
  titleKey: string;
  labelKey: string;
  permission: Permission;
}[];

/** The icon of a tab in its state; every icon above has an "-outline" twin in Ionicons. */
export const tabIcon = (icon: (typeof TABS)[number]["icon"], focused: boolean): IconName =>
  focused ? icon : `${icon}-outline`;
