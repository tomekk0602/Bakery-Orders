import { RequestArchiveQuery } from "@bakery/core/contracts";
import { requirePermission } from "@/server/auth";
import { fail, json } from "@/server/runtime";
import { requestArchive } from "@/server/staff/requests";

/**
 * GET /api/staff/requests/archive?outcome=&q=&cursor= — requests closed before today, newest closed
 * first, 20 a page; only the owner (spec 001 FR-054, FR-055; research R34).
 */
export async function GET(req: Request) {
  const r = await requirePermission(req, "request:archive");
  if ("response" in r) return r.response;
  const params = Object.fromEntries([...new URL(req.url).searchParams].filter(([, v]) => v !== ""));
  const query = RequestArchiveQuery.safeParse(params);
  if (!query.success) return fail("invalid", "Neplatný dotaz.", 400);
  return json(await requestArchive(query.data));
}
