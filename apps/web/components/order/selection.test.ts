import { describe, expect, it } from "vitest";
import { changeQuantity, selectedProducts } from "./selection";
import { deadline } from "../home/format";

describe("catalogue selection", () => {
  const products = [
    { id: "bread", name: "Chléb", priceCzk: 69 },
    { id: "roll", name: "Rohlík", priceCzk: 4 },
  ];
  it("keeps card quantities and priced summary in sync after additions and removals", () => {
    let q = changeQuantity({}, "bread", 2);
    q = changeQuantity(q, "roll", 6);
    q = changeQuantity(q, "bread", -1);
    expect(selectedProducts(products, q).reduce((sum, p) => sum + p.quantity * p.priceCzk, 0)).toBe(93);
    q = changeQuantity(q, "bread", -1);
    expect(selectedProducts(products, q)).toEqual([{ ...products[1], quantity: 6 }]);
  });
  it("does not submit unknown or zero products and bounds quantities", () => {
    expect(selectedProducts(products, { unknown: 2, bread: 0 })).toEqual([]);
    expect(changeQuantity({ bread: 200 }, "bread", 1).bread).toBe(200);
    expect(changeQuantity({}, "bread", -1)).toEqual({});
  });
  it("does not claim the cutoff is always one day before pickup", () => {
    expect(deadline(0, "14:00")).toContain("v den vyzvednutí");
    expect(deadline(1, "14:00")).toContain("den předem");
    expect(deadline(2, "12:00")).toContain("2 dny předem");
    expect(deadline(5, "12:00")).toContain("5 dní předem");
  });
});
