import "server-only";
import { breaksQuietHours, isQuiet, notificationText, subjectOf } from "@bakery/core";
import { notifyStaff, pendingPushes, recordPush } from "@bakery/db";
import { after } from "next/server";
import { log } from "../log";
import { db } from "../runtime";
import { type SendPush, sendWebPush, vapidPublicKey } from "./push";

/**
 * Pushes the given notifications to their recipients' devices: only those wanted on devices, not read
 * yet, outside the recipient's quiet hours unless the kind breaks them (FR-009–FR-011, FR-015). Every
 * attempt is recorded; a device that is gone is removed. The link stays an app path: the Service Worker
 * resolves it against its own scope, /staff/ when deployed (research N5). Returns how many went out.
 */
export async function deliverPushes(ids: string[], now = new Date(), send: SendPush = sendWebPush): Promise<number> {
  if (ids.length === 0 || !vapidPublicKey()) return 0;
  let sent = 0;
  for (const p of await pendingPushes(db(), ids)) {
    if (isQuiet(now, p.quiet) && !breaksQuietHours(p.kind)) continue;
    const payload = JSON.stringify({ title: p.title, body: p.body, link: p.link, tag: p.subject });
    for (const d of p.devices) {
      const r = await send(d, payload);
      await recordPush(db(), { notificationId: p.id, deviceId: d.id, ...r }, now);
      if (r.result === "sent") sent += 1;
      else log.warn({ notification: p.id, result: r.result }, "push not delivered");
    }
  }
  return sent;
}

/**
 * Delivery after the response (ADR-0016 D1): a serverless function may freeze once it has answered.
 * With device notifications off there is nothing to schedule.
 */
export function scheduleDelivery(ids: string[]): void {
  if (ids.length === 0 || !vapidPublicKey()) return;
  after(() =>
    deliverPushes(ids).catch((e: unknown) =>
      log.error({ err: e instanceof Error ? e.message : String(e) }, "push delivery failed"),
    ),
  );
}

/**
 * Tells the owner the phone assistant cannot start calls, at most once an hour and also during quiet
 * hours (spec 002 FR-019). Delivery runs after the customer's refusal has been answered.
 */
export async function alertAssistantDown(reason: "quota" | "unavailable", now = new Date()): Promise<void> {
  const ids = await notifyStaff(db(), {
    kind: "assistant_down",
    subject: subjectOf.assistantDown(now),
    text: notificationText.assistantDown(reason),
  });
  scheduleDelivery(ids);
}
