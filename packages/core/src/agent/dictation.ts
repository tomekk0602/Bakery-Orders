import { decodeHTML } from "entities";
import { z } from "zod";
import type { CalendarDay } from "../calendar.ts";
import { activeProducts, type Product } from "../catalogue.ts";

/** At most this many catalogue products are offered for a word that matched none (FR-020). */
export const MAX_CANDIDATES = 3;

/**
 * Free text from the model, with HTML entities turned back into letters: the model sometimes writes
 * "Horv&#225;th" into a JSON string (research R44, FR-085). A preprocess, so the JSON Schema the model
 * gets is the one it got before; the decoded text is then trimmed and checked.
 */
const spokenText = (min: number, max: number) =>
  z.preprocess((v) => (typeof v === "string" ? decodeHTML(v) : v), z.string().trim().min(min).max(max));

/**
 * What the model may return for one staff sentence (research R22). Products are an enum of the
 * active catalogue and the day an enum of the open days, so a guess outside the offer or the
 * calendar cannot be expressed; a word that matches no product goes to `unmatched` with candidates.
 */
export function buildDictationSchema(catalogue: readonly Product[], calendar: readonly CalendarDay[]) {
  const ids = activeProducts(catalogue).map((p) => p.id);
  const days = calendar.filter((d) => !d.closed).map((d) => d.date);
  if (ids.length === 0 || days.length === 0) throw new Error("buildDictationSchema: no products or no open days");
  const productId = z.enum(ids as [string, ...string[]]);
  return z.object({
    customerName: spokenText(1, 80).nullable(),
    pickupDate: z.enum(days as [string, ...string[]]).nullable(),
    items: z.array(z.object({ productId, quantity: z.number().int().min(1).max(200) })).max(20),
    unmatched: z
      .array(
        z.object({
          word: spokenText(1, 60),
          quantity: z.number().int().min(1).max(200).nullable(),
          candidateIds: z.array(productId).max(MAX_CANDIDATES),
        }),
      )
      .max(10),
  });
}

export type DictationExtraction = z.infer<ReturnType<typeof buildDictationSchema>>;

/** The JSON Schema given to the model as its response format. */
export function dictationJsonSchema(schema: ReturnType<typeof buildDictationSchema>): Record<string, unknown> {
  const { $schema: _ignored, ...json } = z.toJSONSchema(schema) as Record<string, unknown>;
  return json;
}

/** What still has to be filled in before the order can be prepared (FR-021). */
export function missingFields(e: DictationExtraction): ("name" | "day" | "items")[] {
  const missing: ("name" | "day" | "items")[] = [];
  if (!e.customerName) missing.push("name");
  if (!e.pickupDate) missing.push("day");
  if (e.items.length === 0) missing.push("items");
  return missing;
}
