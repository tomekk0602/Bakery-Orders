import { describe, expect, it } from "vitest";
import type { BakerySchedule } from "./calendar.ts";
import type { Product } from "./catalogue.ts";
import { prepareOrder, type PrepareContext } from "./orders.ts";

const catalogue: Product[] = [
  { id: "chleb-kminovy", name: "Kmínový chléb", spokenForms: [], priceCzk: 69, dailyLimit: 30, active: true },
  { id: "rohlik", name: "Rohlík", spokenForms: [], priceCzk: 4, dailyLimit: null, active: true },
  { id: "vanocka", name: "Vánočka", spokenForms: [], priceCzk: 120, dailyLimit: null, active: false },
];
const schedule: BakerySchedule = { closedWeekdays: [7], closedDays: [], cutoffDaysBefore: 1, cutoffTime: "14:00" };
const now = new Date("2026-11-24T09:00:00Z"); // Tuesday 10:00 Prague

const ctx = (over: Partial<PrepareContext> = {}): PrepareContext => ({
  now,
  channel: "phone",
  catalogue,
  schedule,
  staffOverride: false,
  remaining: {},
  ...over,
});
const base = { items: [{ productId: "chleb-kminovy", quantity: 2 }, { productId: "rohlik", quantity: 6 }], pickupDate: "2026-11-28", customerName: "Nováková", customerPhone: "+420777123456" };

describe("prepareOrder", () => {
  it("prepares a priced order with the weekday", () => {
    const r = prepareOrder(base, ctx());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.totalCzk).toBe(162);
      expect(r.pickupWeekdayName).toBe("sobota");
    }
  });

  it("merges repeated products into one line", () => {
    const r = prepareOrder({ ...base, items: [{ productId: "rohlik", quantity: 3 }, { productId: "rohlik", quantity: 2 }] }, ctx());
    expect(r.ok && r.lines).toEqual([expect.objectContaining({ productId: "rohlik", quantity: 5, subtotalCzk: 20 })]);
  });

  it.each([
    ["unknown product", { items: [{ productId: "bageta", quantity: 1 }] }, "unknown_product"],
    ["inactive product", { items: [{ productId: "vanocka", quantity: 1 }] }, "unknown_product"],
    ["empty order", { items: [] }, "empty_order"],
    ["zero quantity", { items: [{ productId: "rohlik", quantity: 0 }] }, "invalid_quantity"],
    ["closed Sunday", { pickupDate: "2026-11-29" }, "closed_day"],
    ["past day", { pickupDate: "2026-11-23" }, "past_day"],
    ["beyond the 14-day window", { pickupDate: "2026-12-12" }, "outside_window"],
    ["after the cut-off", { pickupDate: "2026-11-24" }, "after_cutoff"],
    ["missing name", { customerName: "  " }, "missing_name"],
    ["missing phone on a call", { customerPhone: null }, "missing_phone"],
  ] as const)("refuses %s", (_label, change, reason) => {
    const r = prepareOrder({ ...base, ...(change as Partial<typeof base>) }, ctx());
    expect(r).toEqual(expect.objectContaining({ ok: false, reason }));
  });

  it("refuses more than the remaining daily capacity", () => {
    const r = prepareOrder(base, ctx({ remaining: { "chleb-kminovy": 1 } }));
    expect(r).toEqual(expect.objectContaining({ ok: false, reason: "over_limit" }));
  });

  it("lets staff order after the cut-off and without a phone", () => {
    const r = prepareOrder({ ...base, pickupDate: "2026-11-24", customerPhone: null }, ctx({ channel: "staff", staffOverride: true }));
    expect(r.ok).toBe(true);
  });

  it("does not let staff order for a closed day", () => {
    const r = prepareOrder({ ...base, pickupDate: "2026-11-29" }, ctx({ channel: "staff", staffOverride: true }));
    expect(r).toEqual(expect.objectContaining({ ok: false, reason: "closed_day" }));
  });
});
