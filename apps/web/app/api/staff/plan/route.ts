import { IsoDate } from "@bakery/core/contracts";
import { requirePermission } from "@/server/auth";
import { fail, json } from "@/server/runtime";
import { planForDay } from "@/server/staff/plan";

/** GET /api/staff/plan?day=YYYY-MM-DD — read-only for every role that can view it (FR-010, FR-044). */
export async function GET(req: Request) {
  const r = await requirePermission(req, "plan:view");
  if ("response" in r) return r.response;
  const day = new URL(req.url).searchParams.get("day");
  if (day !== null && !IsoDate.safeParse(day).success) return fail("invalid", "Neplatné datum.", 400);
  return json(await planForDay(day));
}
