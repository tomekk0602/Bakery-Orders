import "server-only";
import { notificationText, subjectOf } from "@bakery/core";
import { notifyStaff, ordersForDay } from "@bakery/db";
import { db } from "../runtime";
import { planForDay } from "../staff/plan";
import { deliverPushes } from "./deliver";

/** How many products the summary names — the three with the most to bake (spec 002 FR-004). */
const SUMMARY_TOP = 3;

/**
 * The daily summary for the next open day (research N8): order count and the top three to bake, also
 * when there are no orders. Once per day and person — a second run creates nothing (FR-005).
 */
export async function sendPlanSummary(now = new Date()) {
  const plan = await planForDay(null, now);
  const top = [...plan.lines]
    .filter((l) => l.toBake > 0)
    .sort((a, b) => b.toBake - a.toBake)
    .slice(0, SUMMARY_TOP)
    .map((l) => ({ name: l.name, toBake: l.toBake }));
  const text = notificationText.planSummary({
    day: plan.day.date,
    weekdayName: plan.day.weekdayName,
    orders: await ordersForDay(db(), plan.day.date),
    top,
  });
  const ids = await notifyStaff(db(), { kind: "plan_summary", subject: subjectOf.planSummary(plan.day.date), text });
  // the cron route answers after delivery: it is not a user waiting, and its function must not freeze first
  const pushed = await deliverPushes(ids, now);
  return { day: plan.day.date, created: ids.length, pushed };
}
