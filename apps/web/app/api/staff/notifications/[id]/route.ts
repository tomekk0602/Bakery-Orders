import { ReadNotificationBody } from "@bakery/core/contracts";
import { markNotificationRead } from "@bakery/db";
import { z } from "zod";
import { requireStaff } from "@/server/notifications/staff";
import { db, fail, json } from "@/server/runtime";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/staff/notifications/:id `{ read: true }` — only the caller's own; 404 otherwise (FR-008). */
export async function PATCH(req: Request, { params }: Ctx) {
  const r = await requireStaff(req);
  if ("response" in r) return r.response;
  const { id } = await params;
  const body = ReadNotificationBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", "Neplatný požadavek.", 400);
  const found = z.uuid().safeParse(id).success && (await markNotificationRead(db(), r.user.id, id));
  return found ? json({ ok: true }) : fail("not_found", "Upozornění neexistuje.", 404);
}
