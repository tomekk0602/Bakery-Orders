import type { CatalogueResponse } from "@bakery/core/contracts";
export type Quantities = Record<string, number>;
export function changeQuantity(q: Quantities, id: string, delta: number): Quantities {
  const next = { ...q, [id]: Math.max(0, Math.min(200, (q[id] ?? 0) + delta)) };
  return Object.fromEntries(Object.entries(next).filter(([, quantity]) => quantity > 0));
}
export function selectedProducts(products: CatalogueResponse["products"], q: Quantities) {
  return products.filter((p) => (q[p.id] ?? 0) > 0).map((p) => ({ ...p, quantity: q[p.id] ?? 0 }));
}
