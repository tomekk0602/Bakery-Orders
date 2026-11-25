import { and, count, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "./client.ts";
import { order, orderLine, walkInBuffer } from "./schema.ts";

/** Pieces ordered per product for a day, from the order lines themselves (cancelled orders excluded). */
export async function reservedForDay(db: Db, day: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ productId: orderLine.productId, quantity: sql<number>`sum(${orderLine.quantity})::int` })
    .from(orderLine)
    .innerJoin(order, eq(order.id, orderLine.orderId))
    .where(and(eq(order.pickupDay, day), inArray(order.status, ["confirmed", "picked_up"])))
    .groupBy(orderLine.productId);
  return Object.fromEntries(rows.map((r) => [r.productId, r.quantity]));
}

/** The owner's walk-in buffer per product for an ISO weekday (1 = Monday … 7 = Sunday). */
export async function buffersForWeekday(db: Db, weekday: number): Promise<Record<string, number>> {
  const rows = await db
    .select({ productId: walkInBuffer.productId, quantity: walkInBuffer.quantity })
    .from(walkInBuffer)
    .where(eq(walkInBuffer.weekday, weekday));
  return Object.fromEntries(rows.map((r) => [r.productId, r.quantity]));
}

/** Orders for a day that will be picked up (cancelled excluded) — the daily summary's count (spec 002 FR-004). */
export async function ordersForDay(db: Db, day: string): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(order)
    .where(and(eq(order.pickupDay, day), inArray(order.status, ["confirmed", "picked_up"])));
  return r?.n ?? 0;
}
