import { markAllNotificationsRead } from "@bakery/db";
import { requireStaff } from "@/server/notifications/staff";
import { db, json } from "@/server/runtime";

/** POST /api/staff/notifications/read-all → `{ read }` (FR-008). */
export async function POST(req: Request) {
  const r = await requireStaff(req);
  if ("response" in r) return r.response;
  return json({ read: await markAllNotificationsRead(db(), r.user.id) });
}
