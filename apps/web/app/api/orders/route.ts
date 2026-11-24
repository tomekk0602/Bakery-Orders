import { placeOrder, WEB_ORDER_LIMIT } from "@/server/customer/orders";
import { readWebOrder, refuse } from "@/server/customer/respond";
import { json } from "@/server/runtime";

/** POST /api/orders — public: saves the confirmed order and returns its number (FR-014, FR-040). */
export async function POST(req: Request) {
  const input = await readWebOrder(req, "web-order", WEB_ORDER_LIMIT);
  if (input instanceof Response) return input;
  const r = await placeOrder(input);
  return r.ok ? json(r.placed) : refuse(r.reason);
}
