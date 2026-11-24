import type { OrderStatus, StaffOrder, StaffOrderDetail, TranscriptTurn } from "@bakery/core/contracts";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import type { Db } from "./client.ts";
import { firstRow } from "./rows.ts";
import { call, order, orderLine, product } from "./schema.ts";

type OrderRow = typeof order.$inferSelect;

async function withLines(db: Db, rows: OrderRow[]): Promise<StaffOrder[]> {
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
    lines: lines.filter((l) => l.orderId === r.id).map(({ orderId: _o, ...l }) => l),
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
