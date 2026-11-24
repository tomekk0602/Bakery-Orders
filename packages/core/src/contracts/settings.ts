import { z } from "zod";
import { IsoDate } from "./orders.ts";

/** Upper bounds that only stop typing mistakes; the bakery's real values are far below them. */
const MAX_PRICE_CZK = 10_000;
const MAX_PIECES = 10_000;
const MAX_CLOSED_DAYS = 60;

export const ProductSettings = z.object({
  id: z.string(),
  name: z.string(),
  priceCzk: z.number().int().min(1).max(MAX_PRICE_CZK),
  /** null = no daily limit */
  dailyLimit: z.number().int().min(1).max(MAX_PIECES).nullable(),
  active: z.boolean(),
  /** walk-in buffer for Monday … Sunday (ISO weekdays 1–7), FR-011 */
  buffers: z.array(z.number().int().min(0).max(MAX_PIECES)).length(7),
});
export type ProductSettings = z.infer<typeof ProductSettings>;

/** GET and PUT /api/staff/settings — the bakery's rules, owner only (FR-011, FR-044). */
export const BakerySettings = z.object({
  cutoffDaysBefore: z.number().int().min(0).max(3),
  cutoffTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "HH:MM"),
  closedWeekdays: z.array(z.number().int().min(1).max(7)).max(6),
  closedDays: z.array(z.object({ day: IsoDate, reason: z.string().trim().max(80).nullable() })).max(MAX_CLOSED_DAYS),
  products: z.array(ProductSettings),
});
export type BakerySettings = z.infer<typeof BakerySettings>;
