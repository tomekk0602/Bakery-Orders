import { listNotifications } from "@bakery/db";
import { z } from "zod";
import { requireStaff } from "@/server/notifications/staff";
import { db, json } from "@/server/runtime";

const Limit = z.coerce.number().int().min(1).max(100).catch(50);

/** GET /api/staff/notifications — the caller's own, newest first, with the unread count (spec 002 FR-007). */
export async function GET(req: Request) {
  const r = await requireStaff(req);
  if ("response" in r) return r.response;
  const limit = Limit.parse(new URL(req.url).searchParams.get("limit") ?? undefined);
  return json(await listNotifications(db(), r.user.id, limit));
}
