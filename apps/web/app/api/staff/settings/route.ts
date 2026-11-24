import { BakerySettings } from "@bakery/core/contracts";
import { requirePermission } from "@/server/auth";
import { fail, json } from "@/server/runtime";
import { bakerySettingsDoc, updateBakerySettings } from "@/server/staff/settings";

/** GET /api/staff/settings — owner only, also for reading (FR-011, FR-044). */
export async function GET(req: Request) {
  const r = await requirePermission(req, "settings:edit");
  if ("response" in r) return r.response;
  return json(await bakerySettingsDoc());
}

/** PUT /api/staff/settings — replaces cut-off, closed days, prices, limits and buffers in one go. */
export async function PUT(req: Request) {
  const r = await requirePermission(req, "settings:edit");
  if ("response" in r) return r.response;
  const body = BakerySettings.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", "Zkontrolujte zadané hodnoty.", 400);
  const saved = await updateBakerySettings(body.data);
  return saved.ok ? json(await bakerySettingsDoc()) : fail("unknown_product", "Neznámý výrobek.", 400);
}
