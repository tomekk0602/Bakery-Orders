import { SetOrderStatusBody } from "@bakery/core/contracts";
import { z } from "zod";
import { requirePermission } from "@/server/auth";
import { fail, json } from "@/server/runtime";
import { orderDetail, setHandedOver } from "@/server/staff/orders";

type Ctx = { params: Promise<{ id: string }> };
const isId = (id: string) => z.uuid().safeParse(id).success;

/** GET /api/staff/orders/:id — the order with its call transcript (FR-012). */
export async function GET(req: Request, { params }: Ctx) {
  const r = await requirePermission(req, "order:view");
  if ("response" in r) return r.response;
  const { id } = await params;
  const detail = isId(id) ? await orderDetail(id) : null;
  return detail ? json(detail) : fail("not_found", "Objednávka neexistuje.", 404);
}

/** PATCH /api/staff/orders/:id — hand over, or undo a hand-over (FR-012). */
export async function PATCH(req: Request, { params }: Ctx) {
  const r = await requirePermission(req, "order:pickup");
  if ("response" in r) return r.response;
  const { id } = await params;
  const body = SetOrderStatusBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", "Neplatný požadavek.", 400);
  if (!isId(id)) return fail("not_found", "Objednávka neexistuje.", 404);
  const result = await setHandedOver(id, body.data);
  if (result.ok) return json({ ok: true });
  return result.reason === "cancelled"
    ? fail("cancelled", "Zrušenou objednávku nelze vydat.", 409)
    : fail("not_found", "Objednávka neexistuje.", 404);
}
