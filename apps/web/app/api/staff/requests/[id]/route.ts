import { SetRequestDoneBody } from "@bakery/core/contracts";
import { z } from "zod";
import { requirePermission } from "@/server/auth";
import { fail, json } from "@/server/runtime";
import { setRequestDone } from "@/server/staff/requests";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/staff/requests/:id — mark handled or reopen (FR-041). */
export async function PATCH(req: Request, { params }: Ctx) {
  const r = await requirePermission(req, "request:resolve");
  if ("response" in r) return r.response;
  const { id } = await params;
  const body = SetRequestDoneBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", "Neplatný požadavek.", 400);
  const found = z.uuid().safeParse(id).success && (await setRequestDone(id, body.data.done));
  return found ? json({ ok: true }) : fail("not_found", "Požadavek neexistuje.", 404);
}
