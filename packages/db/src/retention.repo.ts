import { and, eq, isNotNull, lt, max, notExists, sql } from "drizzle-orm";
import type { Db } from "./client.ts";
import { deleteOldNotifications } from "./notifications.repo.ts";
import { call, order, orderDraft, rateLimit, staffRequest } from "./schema.ts";

export type RetentionCutoffs = {
  /** a transcript whose last pickup day is before this day goes (FR-009: 30 days after pickup) */
  pickupDayBefore: string;
  /** a call without an order keeps its transcript until this time */
  callStartedBefore: Date;
  /** drafts that expired before this time go, confirmed or not: the order holds what was kept */
  draftExpiredBefore: Date;
  /** rate-limit counters whose window started before this time can no longer limit anything */
  rateWindowBefore: Date;
  /** notifications created before this time go (spec 002 FR-016: 30 days) */
  notificationCreatedBefore: Date;
  /** closed requests whose closing is before this time go, with their steps (spec 001 FR-057) */
  requestClosedBefore: Date;
};

/** Deletes what is past its retention (FR-009, ADR-0008) and says how much, for the log. */
export async function applyRetention(db: Db, c: RetentionCutoffs) {
  return db.transaction(async (tx) => {
    const lastPickup = tx
      .select({ callId: order.callId, day: max(order.pickupDay).as("day") })
      .from(order)
      .where(isNotNull(order.callId))
      .groupBy(order.callId)
      .as("last_pickup");
    const withOrder = await tx
      .update(call)
      .set({ transcript: null })
      .from(lastPickup)
      .where(and(eq(lastPickup.callId, call.id), lt(lastPickup.day, c.pickupDayBefore), isNotNull(call.transcript)))
      .returning({ id: call.id });
    const withoutOrder = await tx
      .update(call)
      .set({ transcript: null })
      .where(
        and(
          lt(call.startedAt, c.callStartedBefore),
          isNotNull(call.transcript),
          notExists(
            tx
              .select({ one: sql`1` })
              .from(order)
              .where(eq(order.callId, call.id)),
          ),
        ),
      )
      .returning({ id: call.id });
    const drafts = await tx
      .delete(orderDraft)
      .where(lt(orderDraft.expiresAt, c.draftExpiredBefore))
      .returning({ id: orderDraft.id });
    const rates = await tx
      .delete(rateLimit)
      .where(lt(rateLimit.windowStart, c.rateWindowBefore))
      .returning({ key: rateLimit.key });
    const notifications = await deleteOldNotifications(tx, c.notificationCreatedBefore);
    // open requests have no done_at and are never matched
    const requests = await tx
      .delete(staffRequest)
      .where(lt(staffRequest.doneAt, c.requestClosedBefore))
      .returning({ id: staffRequest.id });
    return {
      transcripts: withOrder.length + withoutOrder.length,
      drafts: drafts.length,
      rateLimits: rates.length,
      notifications,
      requests: requests.length,
    };
  });
}
