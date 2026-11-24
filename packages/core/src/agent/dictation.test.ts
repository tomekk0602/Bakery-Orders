import { describe, expect, it } from "vitest";
import { buildCalendar, type BakerySchedule } from "../calendar.ts";
import type { Product } from "../catalogue.ts";
import { buildDictationSchema, dictationJsonSchema, missingFields } from "./dictation.ts";

const catalogue: Product[] = [
  { id: "chleb-kminovy", name: "Kmínový chléb", spokenForms: [], priceCzk: 69, dailyLimit: null, active: true },
  { id: "chleb-celozrnny", name: "Celozrnný chléb", spokenForms: [], priceCzk: 75, dailyLimit: null, active: true },
  { id: "vanocka", name: "Vánočka", spokenForms: [], priceCzk: 120, dailyLimit: null, active: false },
];
const schedule: BakerySchedule = { closedWeekdays: [7], closedDays: [], cutoffDaysBefore: 1, cutoffTime: "14:00" };
const calendar = buildCalendar(new Date("2026-11-24T09:00:00Z"), schedule);
const schema = buildDictationSchema(catalogue, calendar);
const ok = {
  customerName: "Nováková",
  pickupDate: "2026-11-25",
  items: [{ productId: "chleb-kminovy", quantity: 2 }],
  unmatched: [],
};

describe("dictation schema (FR-020, FR-021, research R22)", () => {
  it("accepts a complete extraction", () => {
    expect(schema.safeParse(ok).success).toBe(true);
  });

  it.each([
    ["a product outside the offer", { items: [{ productId: "bageta", quantity: 1 }] }],
    ["an inactive product", { items: [{ productId: "vanocka", quantity: 1 }] }],
    ["a closed day", { pickupDate: "2026-11-29" }],
    ["a day outside the calendar", { pickupDate: "2027-01-01" }],
    ["a candidate outside the offer", { unmatched: [{ word: "razowy", quantity: 1, candidateIds: ["bageta"] }] }],
  ])("rejects %s", (_label, change) => {
    expect(schema.safeParse({ ...ok, ...change }).success).toBe(false);
  });

  it("the JSON Schema for the model carries the enums and no $schema key", () => {
    const json = JSON.stringify(dictationJsonSchema(schema));
    expect(json).toContain('"chleb-kminovy","chleb-celozrnny"]');
    expect(json).not.toContain("2026-11-29");
    expect(json).not.toContain("$schema");
  });

  it("lists what is missing", () => {
    expect(missingFields({ ...ok, customerName: null, pickupDate: null, items: [] })).toEqual(["name", "day", "items"]);
    expect(missingFields(ok)).toEqual([]);
  });
});
