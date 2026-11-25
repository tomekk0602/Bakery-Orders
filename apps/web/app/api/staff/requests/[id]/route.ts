import { RequestActionBody } from "@bakery/core/contracts";
import { z } from "zod";
import { requirePermission } from "@/server/auth";
import { fail, json } from "@/server/runtime";
import { actOn } from "@/server/staff/requests";

type Ctx = { params: Promise<{ id: string }> };

/** Why a step was refused, in the staff's language (spec 001 FR-047–FR-050). */
const REFUSED = {
  not_found: [404, "Požadavek neexistuje."],
  no_phone: [422, "Požadavek nemá telefonní číslo."],
  too_early: [422, "Uzavřít jako nedovoláno lze až po třech pokusech."],
  closed: [409, "Požadavek je už uzavřený."],
  open: [409, "Požadavek je otevřený."],
} as const;

/** PATCH /api/staff/requests/:id `{ action, note? }` — one step on a request (FR-047–FR-051). */
export async function PATCH(req: Request, { params }: Ctx) {
  const r = await requirePermission(req, "request:resolve");
  if ("response" in r) return r.response;
  const { id } = await params;
  const body = RequestActionBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", "Neplatný požadavek.", 400);
  if (!z.uuid().safeParse(id).success) return fail("not_found", REFUSED.not_found[1], 404);
  const result = await actOn(id, r.user.id, body.data);
  if (result.ok) return json({ ok: true });
  const [status, message] = REFUSED[result.reason];
  return fail(result.reason, message, status);
}
