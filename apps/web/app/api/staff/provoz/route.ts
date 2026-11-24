import { ProvozPeriod } from "@bakery/core/contracts";
import { requirePermission } from "@/server/auth";
import { fail, json } from "@/server/runtime";
import { provoz } from "@/server/staff/provoz";

/** GET /api/staff/provoz?days=7|30 — the owner's view of the phone agent (FR-033). */
export async function GET(req: Request) {
  const r = await requirePermission(req, "ops:view");
  if ("response" in r) return r.response;
  const days = ProvozPeriod.safeParse(new URL(req.url).searchParams.get("days") ?? "7");
  if (!days.success) return fail("invalid", "Neplatné období.", 400);
  return json(await provoz(days.data));
}
