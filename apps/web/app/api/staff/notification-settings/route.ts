import { UpdateNotificationSettings } from "@bakery/core/contracts";
import { notificationSettings, saveNotificationSettings } from "@bakery/db";
import { vapidPublicKey } from "@/server/notifications/push";
import { requireStaff } from "@/server/notifications/staff";
import { db, fail, json } from "@/server/runtime";

/** GET /api/staff/notification-settings — kinds, quiet hours, this server's VAPID key, devices (FR-014, FR-015). */
export async function GET(req: Request) {
  const r = await requireStaff(req);
  if ("response" in r) return r.response;
  return json(await notificationSettings(db(), r.user, vapidPublicKey()));
}

/** PUT — a kind the role cannot act on is refused with 403 (FR-006, FR-014). */
export async function PUT(req: Request) {
  const r = await requireStaff(req);
  if ("response" in r) return r.response;
  const body = UpdateNotificationSettings.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", "Neplatné nastavení.", 400);
  const saved = await saveNotificationSettings(db(), r.user, body.data);
  if (!saved.ok) return fail("forbidden", "Tento druh upozornění vaše role nedostává.", 403);
  return json(await notificationSettings(db(), r.user, vapidPublicKey()));
}
