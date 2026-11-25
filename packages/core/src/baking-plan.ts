import type { Product } from "./catalogue.ts";

export type PlanLine = { productId: string; name: string; reserved: number; buffer: number; toBake: number };
export type BakingPlan = { lines: PlanLine[]; totals: { reserved: number; buffer: number; toBake: number } };

/**
 * What to bake for a day: reserved pieces plus the owner's walk-in buffer (FR-010). Every active
 * product is listed; an inactive one appears only while it still has orders, and only with them —
 * it is not on the shelf, so it has no buffer (FR-084). A closed day has no walk-in sales, so no buffer.
 */
export function bakingPlan(
  catalogue: readonly Product[],
  reserved: Readonly<Record<string, number>>,
  buffers: Readonly<Record<string, number>>,
  closed: boolean,
): BakingPlan {
  const lines = catalogue
    .filter((p) => p.active || (reserved[p.id] ?? 0) > 0)
    .map((p) => {
      const r = reserved[p.id] ?? 0;
      const b = closed || !p.active ? 0 : (buffers[p.id] ?? 0);
      return { productId: p.id, name: p.name, reserved: r, buffer: b, toBake: r + b };
    });
  const totals = lines.reduce(
    (t, l) => ({ reserved: t.reserved + l.reserved, buffer: t.buffer + l.buffer, toBake: t.toBake + l.toBake }),
    { reserved: 0, buffer: 0, toBake: 0 },
  );
  return { lines, totals };
}
