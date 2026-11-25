import { WebOrderConfirm } from "@bakery/core/contracts";
import { placeOrder, WEB_ORDER_LIMIT } from "@/server/customer/orders";
import { overLimit, refuse } from "@/server/customer/respond";
import { fail, json } from "@/server/runtime";

/**
 * POST /api/orders `{ draftId, token }` — public: confirms the reviewed order and returns its number;
 * the same request again returns the same number (FR-014, FR-040, FR-064, FR-065).
 */
export async function POST(req: Request) {
  const limited = await overLimit(req, "web-order", WEB_ORDER_LIMIT);
  if (limited) return limited;
  const body = WebOrderConfirm.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", "Zkontrolujte prosím objednávku znovu.", 400);
  const r = await placeOrder(body.data);
  return r.ok ? json(r.placed) : refuse(r.reason);
}
