import type { PushSubscriptionBody } from "@bakery/core/contracts";
import type { NotificationKind, QuietHours } from "@bakery/core";
import { and, count, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "./client.ts";
import { quietHoursOf } from "./notifications.repo.ts";
import { notification, pushSubscription } from "./schema.ts";

// Devices registered for Web Push and the delivery of notifications to them (spec 002 FR-009–FR-012).

/** Registers this device for the caller; the same endpoint again updates it (FR-009). */
export async function savePushSubscription(db: Db, userId: string, s: PushSubscriptionBody): Promise<string> {
  const v = {
    userId,
    endpoint: s.endpoint,
    p256dh: s.keys.p256dh,
    auth: s.keys.auth,
    userAgent: s.userAgent ?? null,
    failures: 0,
  };
  const [row] = await db
    .insert(pushSubscription)
    .values(v)
    .onConflictDoUpdate({ target: pushSubscription.endpoint, set: v })
    .returning({ id: pushSubscription.id });
  if (!row) throw new Error("push_subscription not saved");
  return row.id;
}

/** Removes the caller's device (turned off, or signing out — FR-012). */
export async function removePushSubscription(db: Db, userId: string, endpoint: string): Promise<void> {
  await db
    .delete(pushSubscription)
    .where(and(eq(pushSubscription.userId, userId), eq(pushSubscription.endpoint, endpoint)));
}

export type PendingPush = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
  subject: string;
  quiet: QuietHours;
  devices: { id: string; endpoint: string; p256dh: string; auth: string }[];
};

/**
 * Notifications from `ids` still to be pushed: wanted on devices, not sent yet, and not already read —
 * a request handled before the push goes out is not pushed (spec 002 edge case).
 */
export async function pendingPushes(db: Db, ids: string[]): Promise<PendingPush[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(notification)
    .where(
      and(
        inArray(notification.id, ids),
        eq(notification.push, true),
        isNull(notification.pushSentAt),
        isNull(notification.readAt),
      ),
    );
  const out: PendingPush[] = [];
  for (const n of rows) {
    const devices = await db
      .select({
        id: pushSubscription.id,
        endpoint: pushSubscription.endpoint,
        p256dh: pushSubscription.p256dh,
        auth: pushSubscription.auth,
      })
      .from(pushSubscription)
      .where(eq(pushSubscription.userId, n.recipientId));
    out.push({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      link: n.link,
      subject: n.subject,
      quiet: await quietHoursOf(db, n.recipientId),
      devices,
    });
  }
  return out;
}

/** One attempt's result: the notification's delivery and the device's health (FR-011). */
export async function recordPush(
  db: Db,
  v: { notificationId: string; deviceId: string; result: "sent" | "gone" | "failed"; error?: string },
  now = new Date(),
): Promise<void> {
  if (v.result === "sent") {
    await db
      .update(notification)
      .set({ pushSentAt: now, pushError: null })
      .where(eq(notification.id, v.notificationId));
    await db
      .update(pushSubscription)
      .set({ lastSuccessAt: now, failures: 0 })
      .where(eq(pushSubscription.id, v.deviceId));
    return;
  }
  if (v.result === "gone") {
    // 404/410: the browser withdrew the registration for good (research N9)
    await db.delete(pushSubscription).where(eq(pushSubscription.id, v.deviceId));
    return;
  }
  await db
    .update(notification)
    .set({ pushError: v.error?.slice(0, 300) ?? "failed" })
    .where(eq(notification.id, v.notificationId));
  await db
    .update(pushSubscription)
    .set({ failures: sql`${pushSubscription.failures} + 1` })
    .where(eq(pushSubscription.id, v.deviceId));
}

/** The test notification sent on registering a device: only the device's health (FR-009, FR-011). */
export async function recordDeviceTest(
  db: Db,
  deviceId: string,
  result: "sent" | "gone" | "failed",
  now = new Date(),
): Promise<void> {
  if (result === "gone") {
    await db.delete(pushSubscription).where(eq(pushSubscription.id, deviceId));
    return;
  }
  await db
    .update(pushSubscription)
    .set(result === "sent" ? { lastSuccessAt: now, failures: 0 } : { failures: sql`${pushSubscription.failures} + 1` })
    .where(eq(pushSubscription.id, deviceId));
}

/** Push deliveries that failed in [from, to), for "Provoz" (FR-011, SC-006). */
export async function pushFailures(db: Db, from: Date, to: Date): Promise<number> {
  const [r] = await db
    .select({ n: count() })
    .from(notification)
    .where(
      and(
        isNotNull(notification.pushError),
        isNull(notification.pushSentAt),
        gte(notification.createdAt, from),
        lt(notification.createdAt, to),
      ),
    );
  return r?.n ?? 0;
}
