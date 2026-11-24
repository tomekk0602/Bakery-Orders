import { SetOrderStatusBody } from "@bakery/core/contracts";
import { z } from "zod";
import { requirePermission } from "@/server/auth";
import { fail, json } from "@/server/runtime";
import { orderDetail, setOrderStatus } from "@/server/staff/orders";

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

/** PATCH /api/staff/orders/:id — hand over, undo a hand-over, or cancel (FR-012, FR-013). */
export async function PATCH(req: Request, { params }: Ctx) {
  const body = SetOrderStatusBody.safeParse(await req.json().catch(() => null));
  const r = await requirePermission(
    req,
    body.success && body.data.status === "cancelled" ? "order:cancel" : "order:pickup",
  );
  if ("response" in r) return r.response;
  if (!body.success) return fail("invalid", "Neplatný požadavek.", 400);
  const { id } = await params;
  if (!isId(id)) return fail("not_found", "Objednávka neexistuje.", 404);
  const result = await setOrderStatus(id, body.data);
  if (result.ok) return json({ ok: true });
  if (result.reason === "cancelled") return fail("cancelled", "Objednávka už je zrušená.", 409);
  if (result.reason === "picked_up") return fail("picked_up", "Vydanou objednávku nelze zrušit.", 409);
  return fail("not_found", "Objednávka neexistuje.", 404);
}
