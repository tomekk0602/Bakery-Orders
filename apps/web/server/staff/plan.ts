import "server-only";
import { bakingPlan, buildCalendar, describeDay, pragueDate, type CalendarDay } from "@bakery/core";
import { BakingPlanResponse, type PlanDay } from "@bakery/core/contracts";
import { buffersForWeekday, loadBakery, reservedForDay } from "@bakery/db";
import { db } from "../runtime";

/** Days the plan can be shown for: the same 14-day window the orders are taken in. */
const PLAN_DAYS = 14;

const toPlanDay = (d: CalendarDay): PlanDay => ({ date: d.date, weekdayName: d.weekdayName, relative: d.relative, closed: d.closed });

/**
 * The baking plan for a day (FR-010). Without a day it is the next open day after today, because
 * the bakery bakes at night for the morning.
 */
export async function planForDay(day: string | null, now = new Date()): Promise<BakingPlanResponse> {
  const bakery = await loadBakery(db());
  const days = buildCalendar(now, bakery.schedule, PLAN_DAYS);
  const nextOpen = days.slice(1).find((d) => !d.closed) ?? describeDay(pragueDate(now), bakery.schedule, "today");
  const chosen = day ? (days.find((d) => d.date === day) ?? describeDay(day, bakery.schedule)) : nextOpen;
  const [reserved, buffers] = await Promise.all([reservedForDay(db(), chosen.date), buffersForWeekday(db(), chosen.weekday)]);
  const plan = bakingPlan(bakery.catalogue, reserved, buffers, chosen.closed);
  return BakingPlanResponse.parse({ day: toPlanDay(chosen), ...plan, days: days.map(toPlanDay) });
}
