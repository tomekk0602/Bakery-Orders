import type { Product } from "./catalogue.ts";

export type OrderItem = { productId: string; quantity: number };

export type PricedLine = {
  productId: string;
  name: string;
  quantity: number;
  unitPriceCzk: number;
  subtotalCzk: number;
};

/** Prices validated items from the catalogue. Every product id must exist in it. */
export function priceLines(items: readonly OrderItem[], catalogue: readonly Product[]): PricedLine[] {
  return items.map(({ productId, quantity }) => {
    const p = catalogue.find((c) => c.id === productId);
    if (!p) throw new Error(`priceLines: unknown product ${productId}`);
    return { productId, name: p.name, quantity, unitPriceCzk: p.priceCzk, subtotalCzk: p.priceCzk * quantity };
  });
}

export const orderTotal = (lines: readonly PricedLine[]): number => lines.reduce((s, l) => s + l.subtotalCzk, 0);
