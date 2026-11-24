import type { OrderChannel, PreparedOrder } from "@bakery/core";
import { and, eq, gt, isNull, sql, TransactionRollbackError } from "drizzle-orm";
import type { Db } from "./client.ts";
import { firstRow } from "./rows.ts";
import { dailyCapacity, order, orderDraft, orderLine, product } from "./schema.ts";

/** A prepared order waits this long for confirmation (data-model `order_draft`). */
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export async function saveDraft(
  db: Db,
  prepared: PreparedOrder,
  channel: OrderChannel,
  callId: string | null,
  now = new Date(),
): Promise<string> {
  const rows = await db
    .insert(orderDraft)
    .values({ channel, callId, payload: prepared, expiresAt: new Date(now.getTime() + DRAFT_TTL_MS) })
    .returning({ id: orderDraft.id });
  return firstRow(rows, "order_draft").id;
}

export type ConfirmMeta = { callId: string | null; promptVersion: string | null; model: string | null };
export type ConfirmResult = { ok: true; orderNumber: number; orderId: string } | { ok: false; reason: "no_draft" | "over_limit" };

/**
 * Saves a draft as an order. Capacity is taken with a conditional update inside the transaction, so
 * two concurrent orders can never take the same last pieces (research R14, spec E4).
 */
export async function confirmDraft(db: Db, draftId: string, callId: string | null, meta: ConfirmMeta, now = new Date()): Promise<ConfirmResult> {
  return db.transaction(async (tx) => {
    const [draft] = await tx
      .select()
      .from(orderDraft)
      .where(
        and(
          eq(orderDraft.id, draftId),
          gt(orderDraft.expiresAt, now),
          isNull(orderDraft.confirmedOrderId),
          callId === null ? isNull(orderDraft.callId) : eq(orderDraft.callId, callId),
        ),
      )
      .for("update");
    if (!draft) return { ok: false, reason: "no_draft" } as const;
    const p = draft.payload as PreparedOrder;

    for (const line of p.lines) {
      const [limit] = await tx.select({ dailyLimit: product.dailyLimit }).from(product).where(eq(product.id, line.productId));
      await tx.insert(dailyCapacity).values({ productId: line.productId, day: p.pickupDate, reserved: 0 }).onConflictDoNothing();
      const updated = await tx
        .update(dailyCapacity)
        .set({ reserved: sql`${dailyCapacity.reserved} + ${line.quantity}` })
        .where(
          and(
            eq(dailyCapacity.productId, line.productId),
            eq(dailyCapacity.day, p.pickupDate),
            limit?.dailyLimit == null ? sql`true` : sql`${dailyCapacity.reserved} + ${line.quantity} <= ${limit.dailyLimit}`,
          ),
        )
        .returning({ reserved: dailyCapacity.reserved });
      if (updated.length === 0) {
        tx.rollback();
      }
    }

    const savedRows = await tx
      .insert(order)
      .values({
        source: draft.channel,
        customerName: p.customerName,
        customerPhone: p.customerPhone,
        pickupDay: p.pickupDate,
        totalCzk: p.totalCzk,
        promptVersion: meta.promptVersion,
        model: meta.model,
        callId: meta.callId,
      })
      .returning({ id: order.id, number: order.number });
    const saved = firstRow(savedRows, "order");
    await tx.insert(orderLine).values(p.lines.map((l) => ({ orderId: saved.id, productId: l.productId, quantity: l.quantity, unitPriceCzk: l.unitPriceCzk })));
    await tx.update(orderDraft).set({ confirmedOrderId: saved.id }).where(eq(orderDraft.id, draft.id));
    return { ok: true, orderNumber: saved.number, orderId: saved.id } as const;
  }).catch((e: unknown) => {
    // tx.rollback() above throws TransactionRollbackError; that is the over-limit path.
    if (e instanceof TransactionRollbackError) return { ok: false, reason: "over_limit" } as const;
    throw e;
  });
}

export async function orderNumbersForCall(db: Db, callId: string): Promise<number[]> {
  const rows = await db.select({ number: order.number }).from(order).where(eq(order.callId, callId));
  return rows.map((r) => r.number);
}
