import "server-only";
import type { RefusalReason } from "@bakery/core";
import { WebOrderInput, type WebOrderData } from "@bakery/core/contracts";
import { hitRateLimit } from "@bakery/db";
import { REFUSAL_MESSAGES } from "../refusals";
import { db, fail, ipHash } from "../runtime";

/** Parses a public order body after the per-IP limit; a Response when it must stop here. */
export async function readWebOrder(
  req: Request,
  key: string,
  limit: { max: number; windowMs: number },
): Promise<WebOrderData | Response> {
  if (!(await hitRateLimit(db(), `${key}:${ipHash(req)}`, limit.max, limit.windowMs)))
    return fail(
      "rate_limited",
      "Příliš mnoho objednávek za krátkou dobu. Zkuste to prosím později, nebo nám zavolejte.",
      429,
    );
  const body = WebOrderInput.safeParse(await req.json().catch(() => null));
  return body.success ? body.data : fail("invalid", "Zkontrolujte jméno, telefon, den a výrobky.", 400);
}

export const refuse = (reason: RefusalReason | "no_draft") =>
  reason === "no_draft"
    ? fail("invalid", "Objednávku se nepodařilo uložit.", 400)
    : fail(reason, REFUSAL_MESSAGES[reason], reason === "over_limit" ? 409 : 422);
