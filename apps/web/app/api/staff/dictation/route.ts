import { DictationRequest } from "@bakery/core/contracts";
import { requirePermission } from "@/server/auth";
import { log } from "@/server/log";
import { fail, json } from "@/server/runtime";
import { dictate } from "@/server/staff/dictation";
import { DictationUnavailable } from "@/server/staff/dictation-model";

/** POST /api/staff/dictation — one staff sentence → order card or what is still needed (FR-017–FR-022). */
export async function POST(req: Request) {
  const r = await requirePermission(req, "order:create");
  if ("response" in r) return r.response;
  const body = DictationRequest.safeParse(await req.json().catch(() => null));
  if (!body.success) return fail("invalid", "Řekněte nebo napište objednávku.", 400);
  try {
    return json(await dictate(body.data.text, r.user.id));
  } catch (e) {
    if (!DictationUnavailable.is(e)) throw e;
    // The sentence itself is not logged: it holds a customer's name (ADR-0013).
    log.warn({ event: "dictation_unavailable", reason: e.reason }, "dictation unavailable");
    return e.reason === "quota"
      ? fail("quota_exhausted", "Diktování je dnes vyčerpané. Použijte formulář.", 503)
      : fail("dictation_unavailable", "Diktování je teď nedostupné. Použijte formulář.", 503);
  }
}
