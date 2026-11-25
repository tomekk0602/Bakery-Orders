import { buildCalendar, buildToolSchemas, type BakerySchedule, type Product } from "@bakery/core";
import { describe, expect, it } from "vitest";
import { toolTraceInput } from "./trace-input";

const catalogue = [
  { id: "rohlik", name: "Rohlík", priceCzk: 4, active: true, dailyLimit: null, spokenForms: [] },
] as unknown as Product[];
const schedule = {
  closedWeekdays: [],
  closedDays: [],
  cutoffDaysBefore: 1,
  cutoffTime: "14:00",
} as unknown as BakerySchedule;
const now = new Date("2026-11-25T09:00:00Z");
const schemas = buildToolSchemas(catalogue, buildCalendar(now, schedule));

describe("a tool call's trace input (spec 001 FR-032, research R35)", () => {
  it("a request keeps its kind and drops the note and the name", () => {
    const input = toolTraceInput(schemas, "request_staff", {
      kind: "cancel",
      customer_name: "Jan Novák",
      note: "Pan Jan Novák chce zrušit objednávku",
    });
    expect(input).toEqual({ kind: "cancel" });
    expect(JSON.stringify(input)).not.toContain("Novák");
  });

  it("an order keeps products, quantities and the day, not the name", () => {
    const day = buildCalendar(now, schedule)[1]!.date;
    expect(
      toolTraceInput(schemas, "prepare_order", {
        items: [{ product_id: "rohlik", quantity: 6 }],
        pickup_date: day,
        customer_name: "Nováková",
      }),
    ).toEqual({ items: [{ product_id: "rohlik", quantity: 6 }], pickup_date: day });
  });

  it("arguments that fail validation are not exported; neither is an unknown tool's", () => {
    expect(toolTraceInput(schemas, "request_staff", { kind: "cancel", note: "", extra: "Jan Novák" })).toEqual({
      valid: false,
    });
    expect(toolTraceInput(schemas, "drop_tables", { note: "Jan Novák" })).toEqual({
      valid: false,
      reason: "unknown_tool",
    });
  });
});
