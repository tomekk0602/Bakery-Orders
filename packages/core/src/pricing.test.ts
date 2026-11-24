import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Product } from "./catalogue.ts";
import { orderTotal, priceLines } from "./pricing.ts";

const catalogue: Product[] = [
  { id: "chleb-kminovy", name: "Kmínový chléb", spokenForms: [], priceCzk: 69, dailyLimit: null, active: true },
  { id: "rohlik", name: "Rohlík", spokenForms: [], priceCzk: 4, dailyLimit: null, active: true },
];

describe("priceLines", () => {
  it("prices lines from the catalogue", () => {
    const lines = priceLines(
      [
        { productId: "chleb-kminovy", quantity: 2 },
        { productId: "rohlik", quantity: 6 },
      ],
      catalogue,
    );
    expect(lines.map((l) => l.subtotalCzk)).toEqual([138, 24]);
    expect(orderTotal(lines)).toBe(162);
  });

  it("total is the sum of quantity × unit price for any order", () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ productId: fc.constantFrom("chleb-kminovy", "rohlik"), quantity: fc.integer({ min: 1, max: 200 }) }), {
          minLength: 1,
          maxLength: 20,
        }),
        (items) => {
          const lines = priceLines(items, catalogue);
          const expected = items.reduce((s, i) => s + i.quantity * (i.productId === "rohlik" ? 4 : 69), 0);
          expect(orderTotal(lines)).toBe(expected);
        },
      ),
    );
  });
});
