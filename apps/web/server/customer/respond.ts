import "server-only";
import type { RefusalReason } from "@bakery/core";
import { WebOrderInput, type WebOrderData } from "@bakery/core/contracts";
import { hitRateLimit } from "@bakery/db";
import { REFUSAL_MESSAGES } from "../refusals";
import { db, fail, ipHash } from "../runtime";

/** The per-IP limit of a public order route; the refusal to send, or null to go on (ADR-0014). */
export async function overLimit(
  req: Request,
  key: string,
  limit: { max: number; windowMs: number },
): Promise<Response | null> {
  if (await hitRateLimit(db(), `${key}:${ipHash(req)}`, limit.max, limit.windowMs)) return null;
  return fail(
    "rate_limited",
    "Příliš mnoho objednávek za krátkou dobu. Zkuste to prosím později, nebo nám zavolejte.",
    429,
  );
}

/** Parses a public order body after the per-IP limit; a Response when it must stop here. */
export async function readWebOrder(
  req: Request,
  key: string,
  limit: { max: number; windowMs: number },
): Promise<WebOrderData | Response> {
  const limited = await overLimit(req, key, limit);
  if (limited) return limited;
  const body = WebOrderInput.safeParse(await req.json().catch(() => null));
  return body.success ? body.data : fail("invalid", "Zkontrolujte jméno, telefon, den a výrobky.", 400);
}

export const refuse = (reason: RefusalReason | "no_draft") =>
  reason === "no_draft"
    ? // expired after a day, or a token that is not this order's: the customer reviews again (FR-064)
      fail("no_draft", "Shrnutí objednávky už neplatí. Zkontrolujte ji prosím znovu.", 404)
    : fail(reason, REFUSAL_MESSAGES[reason], reason === "over_limit" ? 409 : 422);
