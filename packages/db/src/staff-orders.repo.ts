import type { OrderStatus, StaffOrder, StaffOrderDetail, TranscriptTurn } from "@bakery/core/contracts";
import { and, asc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "./client.ts";
import { firstRow } from "./rows.ts";
import { call, dailyCapacity, order, orderLine, product } from "./schema.ts";

type OrderRow = typeof order.$inferSelect;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function withLines(db: Db | Tx, rows: OrderRow[]): Promise<StaffOrder[]> {
  if (rows.length === 0) return [];
  const lines = await db
    .select({
      orderId: orderLine.orderId,
      productId: orderLine.productId,
      name: product.name,
      quantity: orderLine.quantity,
      unitPriceCzk: orderLine.unitPriceCzk,
    })
    .from(orderLine)
    .innerJoin(product, eq(product.id, orderLine.productId))
    .where(
      inArray(
        orderLine.orderId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(product.sortOrder));
  // grouped once, so the list costs O(orders + lines), not one scan of the lines per order
  const byOrder = new Map<string, StaffOrder["lines"]>();
  for (const { orderId, ...l } of lines) {
    const list = byOrder.get(orderId);
    if (list) list.push(l);
    else byOrder.set(orderId, [l]);
  }
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    source: r.source,
    status: r.status,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    pickupDay: r.pickupDay,
    totalCzk: r.totalCzk,
    createdAt: r.createdAt.toISOString(),
    lines: byOrder.get(r.id) ?? [],
  }));
}

/** Orders to hand over on a day, cancelled ones excluded, in the order they were taken. */
export async function listOrdersForDay(db: Db, day: string): Promise<StaffOrder[]> {
  const rows = await db
    .select()
    .from(order)
    .where(and(eq(order.pickupDay, day), ne(order.status, "cancelled")))
    .orderBy(asc(order.number));
  return withLines(db, rows);
}

export async function getOrderDetail(db: Db, id: string): Promise<StaffOrderDetail | null> {
  const [row] = await db.select().from(order).where(eq(order.id, id));
  if (!row) return null;
  const withItems = firstRow(await withLines(db, [row]), `order ${id} with lines`);
  const [callRow] = row.callId
    ? await db.select({ transcript: call.transcript }).from(call).where(eq(call.id, row.callId))
    : [];
  return { ...withItems, transcript: (callRow?.transcript as TranscriptTurn[] | null | undefined) ?? null };
}

export type SetStatusResult = { ok: true } | { ok: false; reason: "not_found" | "cancelled" };

/** Hands an order over (or undoes it). A cancelled order cannot be handed over. */
export async function setOrderHandedOver(
  db: Db,
  id: string,
  status: Extract<OrderStatus, "picked_up" | "confirmed">,
  now = new Date(),
): Promise<SetStatusResult> {
  const updated = await db
    .update(order)
    .set({ status, updatedAt: now })
    .where(and(eq(order.id, id), ne(order.status, "cancelled")))
    .returning({ id: order.id });
  if (updated.length > 0) return { ok: true };
  const [exists] = await db.select({ id: order.id }).from(order).where(eq(order.id, id));
  return { ok: false, reason: exists ? "cancelled" : "not_found" };
}

export type CancelResult = { ok: true } | { ok: false; reason: "not_found" | "cancelled" | "picked_up" };

/**
 * Cancels an order and gives its quantities back to the day's limits, in one transaction, so the
 * baking plan and the remaining capacity change together (FR-013, research R31). A handed-over order
 * is not cancelled: the bread has left the shop.
 */
export async function cancelOrder(db: Db, id: string, now = new Date()): Promise<CancelResult> {
  return db.transaction((tx) => cancelOrderIn(tx, id, now));
}

/** The cancel itself, inside a caller's transaction — also used when a request is handled (FR-052). */
export async function cancelOrderIn(tx: Tx, id: string, now: Date): Promise<CancelResult> {
  const [current] = await tx
    .select({ status: order.status, day: order.pickupDay })
    .from(order)
    .where(eq(order.id, id))
    .for("update");
  if (!current) return { ok: false, reason: "not_found" } as const;
  if (current.status !== "confirmed") return { ok: false, reason: current.status } as const;
  await tx.update(order).set({ status: "cancelled", updatedAt: now }).where(eq(order.id, id));
  const lines = await tx
    .select({ productId: orderLine.productId, quantity: orderLine.quantity })
    .from(orderLine)
    .where(eq(orderLine.orderId, id))
    // the same order in which orders take capacity (spec 001 FR-061)
    .orderBy(asc(orderLine.productId));
  for (const l of lines)
    await tx
      .update(dailyCapacity)
      .set({ reserved: sql`greatest(${dailyCapacity.reserved} - ${l.quantity}, 0)` })
      .where(and(eq(dailyCapacity.productId, l.productId), eq(dailyCapacity.day, current.day)));
  return { ok: true } as const;
}

/**
 * A phone number's confirmed orders from `fromDay` on, matched on the last nine digits however the
 * number was written (spec 001 FR-052, research R33).
 */
export async function confirmedOrdersForPhone(db: Db | Tx, key: string, fromDay: string): Promise<StaffOrder[]> {
  const rows = await db
    .select()
    .from(order)
    .where(
      and(
        eq(order.status, "confirmed"),
        gte(order.pickupDay, fromDay),
        sql`right(regexp_replace(coalesce(${order.customerPhone}, ''), '[^0-9]', '', 'g'), 9) = ${key}`,
      ),
    )
    .orderBy(asc(order.pickupDay), asc(order.number));
  return withLines(db, rows);
}
