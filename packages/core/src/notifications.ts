import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { TIME_ZONE } from "./calendar.ts";
import { can, type Role } from "./permissions.ts";
import type { Permission } from "./permissions.ts";

/**
 * What a notification can be about (spec 002). Stage 2 kinds: near_limit, plan_changed, assistant_down;
 * new_order added 2026-11-25 (FR-020). New kinds go last: the database enum only appends.
 */
export const NOTIFICATION_KINDS = [
  "request",
  "plan_summary",
  "near_limit",
  "plan_changed",
  "assistant_down",
  "new_order",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** The action a kind leads to: only people allowed to take it get it (FR-006). */
export const KIND_PERMISSION: Record<NotificationKind, Permission> = {
  request: "request:resolve",
  plan_summary: "plan:view",
  near_limit: "ops:view",
  plan_changed: "plan:view",
  assistant_down: "ops:view",
  new_order: "order:view",
};

export type Preference = { inApp: boolean; push: boolean };

/**
 * Defaults when a person has not chosen (FR-014): requests reach everyone in the app and on devices;
 * the daily summary and the owner's warnings reach the owner; employees can switch the summary on.
 * New orders reach everyone (FR-020).
 */
export function defaultPreference(kind: NotificationKind, role: Role): Preference {
  if (kind === "request" || kind === "new_order") return { inApp: true, push: true };
  if (kind === "plan_changed") return { inApp: true, push: true };
  return role === "owner" ? { inApp: true, push: true } : { inApp: false, push: false };
}

/** Whether a role may receive a kind at all (it can act on it). */
export const kindAllowed = (kind: NotificationKind, role: unknown): boolean => can(role, KIND_PERMISSION[kind]);

export type QuietHours = { enabled: boolean; from: string; to: string };

/** Quiet hours 20:00–04:00 by default (owner, 2026-11-24; spec 002 FR-015). */
export const DEFAULT_QUIET_HOURS: QuietHours = { enabled: true, from: "20:00", to: "04:00" };

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/**
 * Whether `now` falls in the quiet hours, read in the bakery's time zone on that date (research N7).
 * A range across midnight (20:00–04:00) is quiet after `from` or before `to`.
 */
export function isQuiet(now: Date, q: QuietHours): boolean {
  if (!q.enabled || q.from === q.to) return false;
  const local = new TZDate(now, TIME_ZONE);
  const t = local.getHours() * 60 + local.getMinutes();
  const from = minutes(q.from);
  const to = minutes(q.to);
  return from < to ? t >= from && t < to : t >= from || t < to;
}

/** The assistant-down alert reaches the owner even in quiet hours (owner, 2026-11-24; FR-015, FR-019). */
export const breaksQuietHours = (kind: NotificationKind) => kind === "assistant_down";

export type NotificationText = { title: string; body: string; link: string };

/** How an order came in, as a device notification names it (FR-025). */
const CHANNEL_NAME = { phone: "telefonem", web: "přes web", staff: "u pultu" } as const;

const czDay = (day: string) => {
  const d = new Date(`${day}T12:00:00Z`);
  return `${format(d, "d. M.")}`;
};

/** "1 objednávka", "3 objednávky", "5 objednávek" — Czech plural of the count. */
export function ordersCount(n: number): string {
  if (n === 1) return "1 objednávka";
  if (n >= 2 && n <= 4) return `${n} objednávky`;
  return `${n} objednávek`;
}

/**
 * Texts that may appear on a lock screen: what happened, never who (FR-010, research N6). Names and
 * phone numbers are not parameters here, so they cannot end up in a notification.
 */
export const notificationText = {
  request(kind: "callback" | "change" | "cancel"): NotificationText {
    const body = {
      callback: "Zákazník chce, abyste mu zavolali.",
      change: "Zákazník chce změnit objednávku.",
      cancel: "Zákazník chce zrušit objednávku.",
    }[kind];
    return { title: "Nový požadavek", body, link: "/pozadavky" };
  },

  planSummary(s: {
    day: string;
    weekdayName: string;
    orders: number;
    top: { name: string; toBake: number }[];
  }): NotificationText {
    const top = s.top.map((t) => `${t.toBake}× ${t.name}`).join(", ");
    const body =
      s.orders === 0
        ? "Žádné objednávky, pečete jen pro prodejnu."
        : `${ordersCount(s.orders)}${top ? `. Nejvíc upéct: ${top}.` : "."}`;
    return { title: `Plán na ${s.weekdayName} ${czDay(s.day)}`, body, link: "/plan" };
  },

  nearLimit(s: { day: string; weekdayName: string; product: string; left: number }): NotificationText {
    return {
      title: `${s.product}: zbývá ${s.left} ks`,
      body: `Na ${s.weekdayName} ${czDay(s.day)} je téměř vyprodáno. Limit lze upravit v Nastavení.`,
      link: "/nastaveni",
    };
  },

  planChanged(s: { day: string; weekdayName: string }): NotificationText {
    return {
      title: `Plán na ${s.weekdayName} ${czDay(s.day)} se změnil`,
      body: "Po uzávěrce přibyla objednávka.",
      link: "/plan",
    };
  },

  /** No name and no items: they show in the signed-in app's banner, not on a lock screen (FR-025). */
  newOrder(s: {
    orderId: string;
    day: string;
    weekdayName: string;
    channel: keyof typeof CHANNEL_NAME;
  }): NotificationText {
    return {
      title: "Nová objednávka",
      body: `Na ${s.weekdayName} ${czDay(s.day)}, ${CHANNEL_NAME[s.channel]}.`,
      link: `/objednavka/${s.orderId}`,
    };
  },

  assistantDown(reason: "quota" | "unavailable"): NotificationText {
    return {
      title: "Telefonní asistent nefunguje",
      body:
        reason === "quota"
          ? "Došel limit modelu. Zákazníci mohou objednat přes formulář."
          : "Hovory teď nelze spojit. Zákazníci mohou objednat přes formulář.",
      link: "/provoz",
    };
  },
};

/** The dedupe key of a notification: one per subject and person (FR-002, FR-005). */
export const subjectOf = {
  request: (id: string) => `request:${id}`,
  planSummary: (day: string) => `summary:${day}`,
  nearLimit: (productId: string, day: string) => `near_limit:${productId}:${day}`,
  planChanged: (orderId: string) => `plan_changed:${orderId}`,
  newOrder: (orderId: string) => `order:${orderId}`,
  /** one alert per hour (FR-019): the hour in the bakery's time zone */
  assistantDown: (now: Date) => `assistant_down:${format(new TZDate(now, TIME_ZONE), "yyyy-MM-dd'T'HH")}`,
};

/** Share of a daily limit at which the owner is warned (FR-017) — proposed 90%, unmeasured. */
export const NEAR_LIMIT_SHARE = 0.9;
