import { z } from "zod";
import { OrderCard } from "./new-order.ts";
import { IsoDate } from "./orders.ts";

/** POST /api/staff/dictation — one sentence said or typed by staff (FR-018). */
export const DictationRequest = z.object({ text: z.string().trim().min(1, "text").max(500) });
export type DictationRequest = z.infer<typeof DictationRequest>;

export const MissingField = z.enum(["name", "day", "items"]);
export type MissingField = z.infer<typeof MissingField>;

/**
 * What the sentence gave: the recognised fields, words that matched no product with candidates to
 * pick from (FR-020), what is missing (FR-021), and — only when nothing is missing or unmatched — the
 * order card prepared by the core (FR-019).
 */
export const DictationResponse = z.object({
  text: z.string(),
  extraction: z.object({
    customerName: z.string().nullable(),
    pickupDate: IsoDate.nullable(),
    items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive() })),
  }),
  unmatched: z.array(
    z.object({
      word: z.string(),
      quantity: z.number().int().positive().nullable(),
      candidates: z.array(z.object({ id: z.string(), name: z.string() })),
    }),
  ),
  missing: z.array(MissingField),
  card: OrderCard.nullable(),
  refusal: z.object({ code: z.string(), message: z.string() }).nullable(),
});
export type DictationResponse = z.infer<typeof DictationResponse>;
