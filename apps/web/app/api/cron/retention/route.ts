import { refuseUnlessCron } from "@/server/cron";
import { json } from "@/server/runtime";
import { runRetention } from "@/server/retention";

/** GET /api/cron/retention — run nightly by Vercel Cron (FR-009; spec 002 FR-016). */
export async function GET(req: Request) {
  return refuseUnlessCron(req) ?? json(await runRetention());
}
