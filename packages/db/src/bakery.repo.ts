import type { BakerySchedule, Product } from "@bakery/core";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db } from "./client.ts";
import { bakerySettings, closedDay, dailyCapacity, product } from "./schema.ts";

export type Bakery = { name: string; schedule: BakerySchedule; callCapSeconds: number; catalogue: Product[] };

export async function loadBakery(db: Db): Promise<Bakery> {
  const [settings] = await db.select().from(bakerySettings).where(eq(bakerySettings.id, 1));
  if (!settings) throw new Error("bakery_settings missing — run the seed");
  const closed = await db.select({ day: closedDay.day }).from(closedDay);
  const products = await db.select().from(product).orderBy(asc(product.sortOrder), asc(product.name));
  return {
    name: settings.name,
    callCapSeconds: settings.callCapSeconds,
    schedule: {
      closedWeekdays: settings.closedWeekdays,
      closedDays: closed.map((c) => c.day),
      cutoffDaysBefore: settings.cutoffDaysBefore,
      cutoffTime: settings.cutoffTime.slice(0, 5),
    },
    catalogue: products.map((p) => ({
      id: p.id,
      name: p.name,
      spokenForms: p.spokenForms,
      priceCzk: p.priceCzk,
      dailyLimit: p.dailyLimit,
      active: p.active,
    })),
  };
}

/** Pieces still available per limited product for a day; unlimited products are absent. */
export async function remainingCapacity(db: Db, catalogue: readonly Product[], day: string): Promise<Record<string, number>> {
  const limited = catalogue.filter((p) => p.dailyLimit !== null);
  if (limited.length === 0) return {};
  const rows = await db
    .select()
    .from(dailyCapacity)
    .where(and(eq(dailyCapacity.day, day), inArray(dailyCapacity.productId, limited.map((p) => p.id))));
  return Object.fromEntries(
    limited.map((p) => [p.id, (p.dailyLimit ?? 0) - (rows.find((r) => r.productId === p.id)?.reserved ?? 0)]),
  );
}
