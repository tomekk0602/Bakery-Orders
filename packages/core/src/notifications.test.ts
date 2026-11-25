import { describe, expect, it } from "vitest";
import {
  DEFAULT_QUIET_HOURS,
  defaultPreference,
  isQuiet,
  kindAllowed,
  NOTIFICATION_KINDS,
  notificationText,
  ordersCount,
  subjectOf,
} from "./notifications.ts";

describe("who gets what (FR-006, FR-014)", () => {
  it("both roles can get requests and the summary; only the owner the owner's warnings", () => {
    expect(kindAllowed("request", "employee")).toBe(true);
    expect(kindAllowed("plan_summary", "employee")).toBe(true);
    expect(kindAllowed("near_limit", "employee")).toBe(false);
    expect(kindAllowed("assistant_down", "employee")).toBe(false);
    for (const k of NOTIFICATION_KINDS) expect(kindAllowed(k, "owner")).toBe(true);
    expect(kindAllowed("request", "customer")).toBe(false);
  });

  it("new orders reach both roles by default (FR-020)", () => {
    expect(kindAllowed("new_order", "employee")).toBe(true);
    expect(defaultPreference("new_order", "employee")).toEqual({ inApp: true, push: true });
    expect(defaultPreference("new_order", "owner")).toEqual({ inApp: true, push: true });
  });

  it("defaults: requests for everyone; the summary on for the owner, off for employees", () => {
    expect(defaultPreference("request", "employee")).toEqual({ inApp: true, push: true });
    expect(defaultPreference("plan_summary", "owner")).toEqual({ inApp: true, push: true });
    expect(defaultPreference("plan_summary", "employee")).toEqual({ inApp: false, push: false });
  });
});

describe("quiet hours in Prague time (FR-015, research N7)", () => {
  // 2026-11-24 is winter time: Prague = UTC+1.
  const at = (utc: string) => new Date(`2026-11-24T${utc}:00Z`);

  it("20:00–04:00 crosses midnight", () => {
    expect(isQuiet(at("18:59"), DEFAULT_QUIET_HOURS)).toBe(false); // 19:59
    expect(isQuiet(at("19:00"), DEFAULT_QUIET_HOURS)).toBe(true); // 20:00
    expect(isQuiet(at("23:30"), DEFAULT_QUIET_HOURS)).toBe(true); // 00:30
    expect(isQuiet(new Date("2026-11-25T02:59:00Z"), DEFAULT_QUIET_HOURS)).toBe(true); // 03:59
    expect(isQuiet(new Date("2026-11-25T03:00:00Z"), DEFAULT_QUIET_HOURS)).toBe(false); // 04:00
  });

  it("a range within one day, and switched off", () => {
    const lunch = { enabled: true, from: "12:00", to: "13:00" };
    expect(isQuiet(at("11:30"), lunch)).toBe(true); // 12:30
    expect(isQuiet(at("12:00"), lunch)).toBe(false); // 13:00
    expect(isQuiet(at("19:30"), { ...DEFAULT_QUIET_HOURS, enabled: false })).toBe(false);
  });

  it("follows summer time", () => {
    // 2026-07-01 22:30 Prague = 20:30 UTC
    expect(isQuiet(new Date("2026-07-01T20:30:00Z"), DEFAULT_QUIET_HOURS)).toBe(true);
    expect(isQuiet(new Date("2026-07-01T17:30:00Z"), DEFAULT_QUIET_HOURS)).toBe(false); // 19:30
  });
});

describe("texts that may show on a lock screen (FR-010)", () => {
  it("say what happened, never who — the functions take no name or phone", () => {
    for (const k of ["callback", "change", "cancel"] as const) {
      const t = notificationText.request(k);
      expect(t.title).toBe("Nový požadavek");
      expect(`${t.title} ${t.body}`).not.toMatch(/\d{3}/);
    }
  });

  it("the summary names the day, the count and what to bake", () => {
    const t = notificationText.planSummary({
      day: "2026-11-25",
      weekdayName: "středa",
      orders: 34,
      top: [
        { name: "Rohlík", toBake: 120 },
        { name: "Houska", toBake: 40 },
      ],
    });
    expect(t.title).toBe("Plán na středa 25. 11.");
    expect(t.body).toBe("34 objednávek. Nejvíc upéct: 120× Rohlík, 40× Houska.");
    expect(t.link).toBe("/plan?day=2026-11-25");
  });

  it("a day without orders still gets a summary", () => {
    expect(notificationText.planSummary({ day: "2026-11-25", weekdayName: "středa", orders: 0, top: [] }).body).toBe(
      "Žádné objednávky, pečete jen pro prodejnu.",
    );
  });

  it("a new order says the day and the channel, never who or what (FR-025)", () => {
    const t = notificationText.newOrder({
      orderId: "o-1",
      day: "2026-11-26",
      weekdayName: "čtvrtek",
      channel: "web",
    });
    expect(t).toEqual({ title: "Nová objednávka", body: "Na čtvrtek 26. 11., přes web.", link: "/objednavka/o-1" });
    expect(subjectOf.newOrder("o-1")).toBe("order:o-1");
  });

  it("Czech plural of orders", () => {
    expect([1, 2, 4, 5, 0].map(ordersCount)).toEqual([
      "1 objednávka",
      "2 objednávky",
      "4 objednávky",
      "5 objednávek",
      "0 objednávek",
    ]);
  });
});

describe("subjects make notifications unique (FR-002, FR-005, FR-019)", () => {
  it("one alert per hour for the assistant", () => {
    expect(subjectOf.assistantDown(new Date("2026-11-24T09:05:00Z"))).toBe("assistant_down:2026-11-24T10");
    expect(subjectOf.assistantDown(new Date("2026-11-24T09:55:00Z"))).toBe("assistant_down:2026-11-24T10");
  });
});
