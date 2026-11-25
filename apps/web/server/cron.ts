import "server-only";
import { timingSafeEqual } from "node:crypto";
import { fail } from "./runtime";

/** Constant-time comparison, so the secret cannot be guessed from response times. */
const sameSecret = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Returns the refusal to send, or null when
 * the caller is the cron; without the secret configured every cron route refuses rather than run unprotected.
 */
export function refuseUnlessCron(req: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) return fail("not_configured", "CRON_SECRET is not set.", 503);
  if (!sameSecret(req.headers.get("authorization") ?? "", `Bearer ${secret}`))
    return fail("unauthorized", "Unauthorized.", 401);
  return null;
}
