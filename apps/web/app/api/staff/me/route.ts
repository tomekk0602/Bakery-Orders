import { ROLE_PERMISSIONS, StaffMeResponse } from "@bakery/core";
import { requirePermission } from "@/server/auth";
import { json } from "@/server/runtime";

/** The signed-in staff member and their permissions; the app shows tabs from these (FR-045). */
export async function GET(req: Request) {
  const r = await requirePermission(req, "order:view");
  if ("response" in r) return r.response;
  return json(StaffMeResponse.parse({ user: r.user, permissions: ROLE_PERMISSIONS[r.user.role] }));
}
