import { eq, sql } from "drizzle-orm";
import type { Db } from "./client.ts";
import { firstRow } from "./rows.ts";
import { call, order, orderLine, rateLimit, staffRequest } from "./schema.ts";

export async function createCall(
  db: Db,
  v: { callerPhone: string; ipHash: string; promptVersion: string; model: string },
): Promise<string> {
  return firstRow(await db.insert(call).values(v).returning({ id: call.id }), "call").id;
}

export async function getCall(db: Db, id: string) {
  const [row] = await db.select().from(call).where(eq(call.id, id));
  return row ?? null;
}

export async function endCall(
  db: Db,
  id: string,
  v: {
    outcome: "order" | "request" | "abandoned" | "error" | "capped";
    transcript: unknown;
    firstAudioMs: number[];
    firstAudioMsP50?: number | null;
    firstAudioMsMax?: number | null;
    tokensIn: number;
    tokensOut: number;
    shadowCostUsd: number;
    traceId: string | null;
  },
  now = new Date(),
): Promise<void> {
  await db
    .update(call)
    .set({
      endedAt: now,
      outcome: v.outcome,
      transcript: v.transcript,
      firstAudioMs: v.firstAudioMs,
      firstAudioMsP50: v.firstAudioMsP50 ?? null,
      firstAudioMsMax: v.firstAudioMsMax ?? null,
      tokensIn: v.tokensIn,
      tokensOut: v.tokensOut,
      shadowCostUsd: v.shadowCostUsd.toFixed(6),
      traceId: v.traceId,
    })
    .where(eq(call.id, id));
}

export async function createStaffRequest(
  db: Db,
  v: {
    kind: "callback" | "change" | "cancel";
    origin: "agent" | "promised_not_recorded" | "web";
    customerName?: string | null;
    customerPhone?: string | null;
    note: string;
    callId?: string | null;
  },
): Promise<string> {
  const rows = await db
    .insert(staffRequest)
    .values({
      ...v,
      customerName: v.customerName ?? null,
      customerPhone: v.customerPhone ?? null,
      callId: v.callId ?? null,
    })
    .returning({ id: staffRequest.id });
  return firstRow(rows, "staff_request").id;
}

export async function hasStaffRequest(db: Db, callId: string): Promise<boolean> {
  const rows = await db
    .select({ id: staffRequest.id })
    .from(staffRequest)
    .where(eq(staffRequest.callId, callId))
    .limit(1);
  return rows.length > 0;
}

/**
 * Counts one hit for `key` in the current fixed window and says whether it is within `max`.
 * Counters live in PostgreSQL (constitution: no Redis; ADR-0014).
 */
export async function hitRateLimit(
  db: Db,
  key: string,
  max: number,
  windowMs: number,
  now = new Date(),
): Promise<boolean> {
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const [row] = await db
    .insert(rateLimit)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({ target: [rateLimit.key, rateLimit.windowStart], set: { count: sql`${rateLimit.count} + 1` } })
    .returning({ count: rateLimit.count });
  return (row?.count ?? 0) <= max;
}

/** What a call left in the database: its saved orders with lines, and the kinds of its staff requests. */
export async function callResult(db: Db, callId: string) {
  const orders = await db
    .select({ id: order.id, name: order.customerName, date: order.pickupDay })
    .from(order)
    .where(eq(order.callId, callId));
  const saved = await Promise.all(
    orders.map(async (o) => {
      const lines = await db
        .select({ productId: orderLine.productId, quantity: orderLine.quantity })
        .from(orderLine)
        .where(eq(orderLine.orderId, o.id));
      return { name: o.name, date: o.date, items: Object.fromEntries(lines.map((l) => [l.productId, l.quantity])) };
    }),
  );
  const requests = await db
    .select({ kind: staffRequest.kind })
    .from(staffRequest)
    .where(eq(staffRequest.callId, callId));
  return { saved, requests: requests.map((r) => r.kind) };
}
