import type { BakerySettings } from "@bakery/core/contracts";
import { asc, eq } from "drizzle-orm";
import type { Db } from "./client.ts";
import { bakerySettings, closedDay, product, walkInBuffer } from "./schema.ts";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export async function loadSettings(db: Db): Promise<BakerySettings> {
  const [s] = await db.select().from(bakerySettings).where(eq(bakerySettings.id, 1));
  if (!s) throw new Error("bakery_settings missing — run the seed");
  const closed = await db.select().from(closedDay).orderBy(asc(closedDay.day));
  const products = await db.select().from(product).orderBy(asc(product.sortOrder), asc(product.name));
  const buffers = await db.select().from(walkInBuffer);
  return {
    cutoffDaysBefore: s.cutoffDaysBefore,
    cutoffTime: s.cutoffTime.slice(0, 5),
    closedWeekdays: s.closedWeekdays,
    closedDays: closed.map((c) => ({ day: c.day, reason: c.reason })),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      priceCzk: p.priceCzk,
      dailyLimit: p.dailyLimit,
      active: p.active,
      buffers: WEEKDAYS.map((w) => buffers.find((b) => b.productId === p.id && b.weekday === w)?.quantity ?? 0),
    })),
  };
}

export type SaveSettingsResult = { ok: true } | { ok: false; reason: "unknown_product"; productId: string };

/**
 * Replaces the bakery's rules in one transaction. Products are edited, never added or removed here;
 * prices apply to new orders only, because saved order lines keep the price they were taken at.
 */
export async function saveSettings(db: Db, s: BakerySettings): Promise<SaveSettingsResult> {
  const known = new Set((await db.select({ id: product.id }).from(product)).map((p) => p.id));
  const unknown = s.products.find((p) => !known.has(p.id));
  if (unknown) return { ok: false, reason: "unknown_product", productId: unknown.id };

  await db.transaction(async (tx) => {
    await tx
      .update(bakerySettings)
      .set({ cutoffDaysBefore: s.cutoffDaysBefore, cutoffTime: s.cutoffTime, closedWeekdays: [...new Set(s.closedWeekdays)].sort() })
      .where(eq(bakerySettings.id, 1));
    await tx.delete(closedDay);
    const days = [...new Map(s.closedDays.map((d) => [d.day, d])).values()];
    if (days.length > 0) await tx.insert(closedDay).values(days.map((d) => ({ day: d.day, reason: d.reason || null })));
    for (const p of s.products) {
      await tx.update(product).set({ priceCzk: p.priceCzk, dailyLimit: p.dailyLimit, active: p.active }).where(eq(product.id, p.id));
      for (const [i, quantity] of p.buffers.entries())
        await tx
          .insert(walkInBuffer)
          .values({ productId: p.id, weekday: i + 1, quantity })
          .onConflictDoUpdate({ target: [walkInBuffer.productId, walkInBuffer.weekday], set: { quantity } });
    }
  });
  return { ok: true };
}
