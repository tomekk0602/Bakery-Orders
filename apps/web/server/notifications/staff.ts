import "server-only";
import { requirePermission } from "../auth";

/**
 * Every signed-in staff member may read and set their own notifications (contracts/http-api.md):
 * `order:view` is held by every staff role, as for /api/staff/me.
 */
export const requireStaff = (req: Request) => requirePermission(req, "order:view");
