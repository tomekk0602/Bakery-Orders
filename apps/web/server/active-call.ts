import "server-only";
import { getCall, loadBakery } from "@bakery/db";
import { CALL_GRACE_MS } from "./call-session";
import { db, ipHash } from "./runtime";

/** The call record if this request may act on it: not ended, within cap + grace, same IP hash. */
export async function activeCall(req: Request, id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const c = await getCall(db(), id);
  if (!c || c.endedAt || c.ipHash !== ipHash(req)) return null;
  const bakery = await loadBakery(db());
  const limit = c.startedAt.getTime() + bakery.callCapSeconds * 1000 + CALL_GRACE_MS;
  return Date.now() <= limit ? { call: c, bakery } : null;
}
