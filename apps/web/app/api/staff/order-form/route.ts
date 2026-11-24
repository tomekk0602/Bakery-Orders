import { requirePermission } from "@/server/auth";
import { json } from "@/server/runtime";
import { orderForm } from "@/server/staff/new-order";

/** GET /api/staff/order-form — products and open days for the new-order form (FR-017). */
export async function GET(req: Request) {
  const r = await requirePermission(req, "order:create");
  if ("response" in r) return r.response;
  return json(await orderForm());
}
