import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { bakingPlan } from "./baking-plan.ts";
import type { Product } from "./catalogue.ts";

const p = (id: string, active = true): Product => ({
  id,
  name: id.toUpperCase(),
  spokenForms: [],
  priceCzk: 10,
  dailyLimit: null,
  active,
});
const catalogue = [p("chleb"), p("rohlik"), p("vanocka", false)];

describe("bakingPlan (FR-010)", () => {
  it("to bake = reserved + walk-in buffer, per product and in total", () => {
    const plan = bakingPlan(catalogue, { chleb: 12, rohlik: 40 }, { chleb: 15, rohlik: 120 }, false);
    expect(plan.lines).toEqual([
      { productId: "chleb", name: "CHLEB", reserved: 12, buffer: 15, toBake: 27 },
      { productId: "rohlik", name: "ROHLIK", reserved: 40, buffer: 120, toBake: 160 },
    ]);
    expect(plan.totals).toEqual({ reserved: 52, buffer: 135, toBake: 187 });
  });

  it("lists every active product, with zero where nothing is ordered", () => {
    const plan = bakingPlan(catalogue, {}, { rohlik: 5 }, false);
    expect(plan.lines.map((l) => [l.productId, l.toBake])).toEqual([
      ["chleb", 0],
      ["rohlik", 5],
    ]);
  });

  it("keeps an inactive product that still has orders, so nothing ordered is forgotten", () => {
    const plan = bakingPlan(catalogue, { vanocka: 2 }, {}, false);
    expect(plan.lines.find((l) => l.productId === "vanocka")?.toBake).toBe(2);
  });

  it("on a closed day there is no walk-in buffer", () => {
    const plan = bakingPlan(catalogue, { chleb: 1 }, { chleb: 15 }, true);
    expect(plan.lines.find((l) => l.productId === "chleb")).toMatchObject({ buffer: 0, toBake: 1 });
  });

  it("for any orders and buffers the plan is correct to the piece (SC-003)", () => {
    const ids = ["chleb", "rohlik", "vanocka"];
    const counts = fc.dictionary(fc.constantFrom(...ids), fc.integer({ min: 0, max: 500 }));
    fc.assert(
      fc.property(counts, counts, fc.boolean(), (reserved, buffers, closed) => {
        const plan = bakingPlan(catalogue, reserved, buffers, closed);
        for (const l of plan.lines) {
          expect(l.reserved).toBe(reserved[l.productId] ?? 0);
          expect(l.toBake).toBe(l.reserved + l.buffer);
          expect(l.buffer).toBe(closed ? 0 : (buffers[l.productId] ?? 0));
        }
        const sum = (k: "reserved" | "buffer" | "toBake") => plan.lines.reduce((s, l) => s + l[k], 0);
        expect(plan.totals).toEqual({ reserved: sum("reserved"), buffer: sum("buffer"), toBake: sum("toBake") });
        for (const [id, n] of Object.entries(reserved))
          if (n > 0) expect(plan.lines.some((l) => l.productId === id)).toBe(true);
      }),
    );
  });
});
