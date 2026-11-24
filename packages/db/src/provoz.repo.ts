import { and, count, gte, lt } from "drizzle-orm";
import type { Db } from "./client.ts";
import { call, order } from "./schema.ts";

/** Raw rows for "Provoz" over [from, to): the calls with their measurements, and orders per source. */
export async function provozRows(db: Db, from: Date, to: Date) {
  const calls = await db
    .select({
      outcome: call.outcome,
      endedAt: call.endedAt,
      firstAudioMs: call.firstAudioMs,
      shadowCostUsd: call.shadowCostUsd,
      promptVersion: call.promptVersion,
    })
    .from(call)
    .where(and(gte(call.startedAt, from), lt(call.startedAt, to)));
  const orders = await db
    .select({ source: order.source, n: count() })
    .from(order)
    .where(and(gte(order.createdAt, from), lt(order.createdAt, to)))
    .groupBy(order.source);
  return { calls, orders };
}
