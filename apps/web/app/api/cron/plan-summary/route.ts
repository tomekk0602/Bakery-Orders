import { refuseUnlessCron } from "@/server/cron";
import { sendPlanSummary } from "@/server/notifications/summary";
import { json } from "@/server/runtime";

/** GET /api/cron/plan-summary — the daily plan summary, run by Vercel Cron (spec 002 FR-004, FR-005; N8). */
export async function GET(req: Request) {
  return refuseUnlessCron(req) ?? json(await sendPlanSummary());
}
