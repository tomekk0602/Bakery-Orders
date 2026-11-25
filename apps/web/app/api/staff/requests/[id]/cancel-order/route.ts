import { can } from "@bakery/core";
import { CancelFromRequestBody } from "@bakery/core/contracts";
import { z } from "zod";
import { requirePermission } from "@/server/auth";
import { fail, json } from "@/server/runtime";
import { cancelFromRequest } from "@/server/staff/requests";

type Ctx = { params: Promise<{ id: string }> };

const REFUSED = {
  not_found: [404, "Objednávka k tomuto požadavku neexistuje."],
  closed: [409, "Požadavek je už uzavřený."],
  not_cancel: [422, "Zrušit objednávku lze jen z požadavku na zrušení."],
  cancelled: [409, "Objednávka je už zrušená."],
  picked_up: [409, "Objednávka už byla vydána."],
} as const;

/**
 * POST /api/staff/requests/:id/cancel-order `{ orderId }` — cancels the order and closes the request as
 * handled in one step (spec 001 FR-052, SC-014). Needs both resolving requests and cancelling orders.
 */
export async function POST(req: Request, { params }: Ctx) {
  const r = await requirePermission(req, "order:cancel");
  if ("response" in r) return r.response;
  if (!can(r.user.role, "request:resolve")) return fail("forbidden", "K této akci nemáte oprávnění.", 403);
  const { id } = await params;
  const body = CancelFromRequestBody.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", "Neplatný požadavek.", 400);
  if (!z.uuid().safeParse(id).success) return fail("not_found", REFUSED.not_found[1], 404);
  const result = await cancelFromRequest(id, body.data.orderId, r.user.id);
  if (result.ok) return json({ ok: true, orderNumber: result.orderNumber });
  const [status, message] = REFUSED[result.reason];
  return fail(result.reason, message, status);
}
