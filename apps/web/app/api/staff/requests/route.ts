import { requirePermission } from "@/server/auth";
import { json } from "@/server/runtime";
import { staffRequests } from "@/server/staff/requests";

/** GET /api/staff/requests — callbacks, changes and cancellations for staff (FR-008, FR-034, FR-041). */
export async function GET(req: Request) {
  const r = await requirePermission(req, "request:view");
  if ("response" in r) return r.response;
  return json(await staffRequests());
}
