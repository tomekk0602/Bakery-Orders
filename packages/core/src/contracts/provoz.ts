import { z } from "zod";
import { IsoDate } from "./orders.ts";

/** The periods "Provoz" can show, in days back from today. */
export const PROVOZ_PERIODS = [7, 30] as const;
export const ProvozPeriod = z.coerce
  .number()
  .int()
  .refine((d): d is (typeof PROVOZ_PERIODS)[number] => (PROVOZ_PERIODS as readonly number[]).includes(d));

const Count = z.number().int().nonnegative();
const Ms = z.number().int().nonnegative().nullable();
const Usd = z.number().nonnegative().nullable();

/** GET /api/staff/provoz?days= — how the phone agent is doing (FR-033, ADR-0013). */
export const ProvozResponse = z.object({
  period: z.object({ days: z.number().int(), from: IsoDate, to: IsoDate }),
  calls: z.object({
    total: Count,
    order: Count,
    request: Count,
    abandoned: Count,
    capped: Count,
    error: Count,
    /** started and not ended (still running, or the browser closed without saying so) */
    open: Count,
  }),
  firstAudio: z.object({ samples: Count, p50Ms: Ms, p95Ms: Ms }),
  orders: z.object({ phone: Count, web: Count, staff: Count }),
  /** share of phone orders staff corrected; null until orders can be edited (T058) */
  phoneCorrectedShare: z.number().min(0).max(1).nullable(),
  cost: z.object({
    shadowUsd: z.number().nonnegative(),
    perCallUsd: Usd,
    perPhoneOrderUsd: Usd,
    pricesReadOn: IsoDate,
  }),
  /** device notifications that could not be delivered in the period (spec 002 FR-011, SC-006) */
  notifications: z.object({ pushFailed: Count }),
  promptVersions: z.array(z.object({ version: z.string(), calls: Count })),
});
export type ProvozResponse = z.infer<typeof ProvozResponse>;
