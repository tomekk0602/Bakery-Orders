import { PROMPT_VERSION } from "@bakery/core";
import { createCall, hitRateLimit, loadBakery } from "@bakery/db";
import { z } from "zod";
import { CALL_START_LIMIT, liveConfig } from "@/server/call-session";
import { log } from "@/server/log";
import { db, fail, genai, ipHash, json, LIVE_MODEL } from "@/server/runtime";

const Body = z.object({ caller_phone: z.string().trim().regex(/^\+?[0-9 ]{9,16}$/, "phone") });

/** Begins a browser call: per-IP limit, a call record, a one-use Live token locked to our config (FR-035, FR-036). */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid", "Zadejte prosím platné telefonní číslo.", 400);

  const hash = ipHash(req);
  if (!(await hitRateLimit(db(), `call:${hash}`, CALL_START_LIMIT.max, CALL_START_LIMIT.windowMs)))
    return fail("rate_limited", "Příliš mnoho hovorů za krátkou dobu. Zkuste to prosím za chvíli, nebo použijte objednávkový formulář.", 429);

  const bakery = await loadBakery(db());
  const now = new Date();
  const callId = await createCall(db(), { callerPhone: parsed.data.caller_phone.replace(/\s+/g, ""), ipHash: hash, promptVersion: PROMPT_VERSION, model: LIVE_MODEL });

  try {
    const token = await genai().authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(now.getTime() + (bakery.callCapSeconds + 60) * 1000).toISOString(),
        newSessionExpireTime: new Date(now.getTime() + 60 * 1000).toISOString(),
        liveConnectConstraints: { model: LIVE_MODEL, config: liveConfig(bakery, now) },
        lockAdditionalFields: [],
      },
    });
    if (!token.name) throw new Error("empty token");
    return json({ call_id: callId, token: token.name, model: LIVE_MODEL, cap_seconds: bakery.callCapSeconds });
  } catch (e) {
    log.error({ err: e instanceof Error ? e.message : String(e) }, "call token failed");
    const quota = e instanceof Error && /quota|RESOURCE_EXHAUSTED|429/.test(e.message);
    return quota
      ? fail("quota_exhausted", "Hlasový asistent je teď vytížený. Objednejte prosím přes formulář.", 503)
      : fail("voice_unavailable", "Hlasový asistent teď není dostupný. Objednejte prosím přes formulář.", 503);
  }
}
