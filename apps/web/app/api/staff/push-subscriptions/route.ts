import { PushSubscriptionBody, RemovePushSubscriptionBody } from "@bakery/core/contracts";
import { recordDeviceTest, removePushSubscription, savePushSubscription } from "@bakery/db";
import { sendTestPush, vapidPublicKey } from "@/server/notifications/push";
import { requireStaff } from "@/server/notifications/staff";
import { db, fail, json } from "@/server/runtime";

/**
 * POST /api/staff/push-subscriptions — registers this device and sends a test notification at once, so
 * the person sees it works (FR-009). Idempotent on the endpoint.
 */
export async function POST(req: Request) {
  const r = await requireStaff(req);
  if ("response" in r) return r.response;
  if (!vapidPublicKey()) return fail("push_off", "Upozornění do zařízení nejsou na serveru zapnutá.", 503);
  const body = PushSubscriptionBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", "Neplatné zařízení.", 400);
  const id = await savePushSubscription(db(), r.user.id, body.data);
  const test = await sendTestPush({ endpoint: body.data.endpoint, ...body.data.keys });
  await recordDeviceTest(db(), id, test.result);
  return json({ id, testSent: test.result === "sent" });
}

/** DELETE — turned off on this device, or signing out (FR-012). */
export async function DELETE(req: Request) {
  const r = await requireStaff(req);
  if ("response" in r) return r.response;
  const body = RemovePushSubscriptionBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", "Neplatné zařízení.", 400);
  await removePushSubscription(db(), r.user.id, body.data.endpoint);
  return new Response(null, { status: 204 });
}
