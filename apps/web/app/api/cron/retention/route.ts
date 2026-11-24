import { timingSafeEqual } from "node:crypto";
import { fail, json } from "@/server/runtime";
import { runRetention } from "@/server/retention";

/** Constant-time comparison, so the secret cannot be guessed from response times. */
const sameSecret = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * GET /api/cron/retention — run nightly by Vercel Cron, which sends `Authorization: Bearer $CRON_SECRET`
 * (FR-009). Without the secret configured the route refuses rather than run unprotected.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return fail("not_configured", "CRON_SECRET is not set.", 503);
  if (!sameSecret(req.headers.get("authorization") ?? "", `Bearer ${secret}`))
    return fail("unauthorized", "Unauthorized.", 401);
  return json(await runRetention());
}
