import { z } from "zod";
import { IsoDate } from "./orders.ts";

export const PlanDay = z.object({ date: IsoDate, weekdayName: z.string(), relative: z.enum(["today", "tomorrow", "day_after"]).nullable(), closed: z.boolean() });
export type PlanDay = z.infer<typeof PlanDay>;

const PlanLine = z.object({ productId: z.string(), name: z.string(), reserved: z.number().int().nonnegative(), buffer: z.number().int().nonnegative(), toBake: z.number().int().nonnegative() });

/** GET /api/staff/plan?day= — the baking plan; `days` lists the days the app can switch to (FR-010). */
export const BakingPlanResponse = z.object({
  day: PlanDay,
  lines: z.array(PlanLine),
  totals: z.object({ reserved: z.number().int().nonnegative(), buffer: z.number().int().nonnegative(), toBake: z.number().int().nonnegative() }),
  days: z.array(PlanDay),
});
export type BakingPlanResponse = z.infer<typeof BakingPlanResponse>;
