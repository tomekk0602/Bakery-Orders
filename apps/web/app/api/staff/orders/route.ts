import { IsoDate, StaffOrderInput } from "@bakery/core/contracts";
import { requirePermission } from "@/server/auth";
import { fail, json } from "@/server/runtime";
import { prepareStaffOrder, REFUSAL_MESSAGES } from "@/server/staff/new-order";
import { ordersForDay } from "@/server/staff/orders";

/** GET /api/staff/orders?day=YYYY-MM-DD — the day's orders (FR-012). */
export async function GET(req: Request) {
  const r = await requirePermission(req, "order:view");
  if ("response" in r) return r.response;
  const day = new URL(req.url).searchParams.get("day");
  if (day !== null && !IsoDate.safeParse(day).success) return fail("invalid", "Neplatné datum.", 400);
  return json(await ordersForDay(day));
}

/** POST /api/staff/orders — staff order from the form → an order card to confirm; nothing saved yet (FR-017, FR-019). */
export async function POST(req: Request) {
  const r = await requirePermission(req, "order:create");
  if ("response" in r) return r.response;
  const input = StaffOrderInput.safeParse(await req.json().catch(() => null));
  if (!input.success) return fail("invalid", "Zkontrolujte jméno, telefon, den a výrobky.", 400);
  const result = await prepareStaffOrder(input.data, r.user.id);
  return result.ok ? json(result.card) : fail(result.reason, REFUSAL_MESSAGES[result.reason], 422);
}
