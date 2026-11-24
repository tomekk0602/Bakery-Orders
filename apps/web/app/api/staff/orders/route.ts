import { IsoDate } from "@bakery/core/contracts";
import { requirePermission } from "@/server/auth";
import { fail, json } from "@/server/runtime";
import { ordersForDay } from "@/server/staff/orders";

/** GET /api/staff/orders?day=YYYY-MM-DD — the day's orders (FR-012). */
export async function GET(req: Request) {
  const r = await requirePermission(req, "order:view");
  if ("response" in r) return r.response;
  const day = new URL(req.url).searchParams.get("day");
  if (day !== null && !IsoDate.safeParse(day).success) return fail("invalid", "Neplatné datum.", 400);
  return json(await ordersForDay(day));
}
