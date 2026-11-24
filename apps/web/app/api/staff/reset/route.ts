import { resetDemo } from "@/server/staff/reset";
import { requirePermission } from "@/server/auth";
import { json } from "@/server/runtime";

/** "Reset demo" — owner only (FR-042, FR-044). */
export async function POST(req: Request) {
  const r = await requirePermission(req, "demo:reset");
  if ("response" in r) return r.response;
  await resetDemo();
  return json({ ok: true });
}
