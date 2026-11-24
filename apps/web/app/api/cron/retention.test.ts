import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startStaffDb } from "@/test/staff-db";

let env: Awaited<ReturnType<typeof startStaffDb>>;
const NOW = new Date("2026-11-24T02:00:00Z");
const ids: Record<string, string> = {};

beforeAll(async () => {
  env = await startStaffDb();
  process.env.CRON_SECRET = "test-cron-secret";
  const { db } = await import("@/server/runtime");
  const { call, order, orderDraft, rateLimit } = await import("@bakery/db");
  const insertCall = async (key: string, startedAt: string) => {
    const [row] = await db()
      .insert(call)
      .values({
        callerPhone: "+420777000111",
        ipHash: "t",
        promptVersion: "v",
        model: "m",
        startedAt: new Date(startedAt),
        transcript: [{ role: "customer", text: key }],
      })
      .returning({ id: call.id });
    ids[key] = row!.id;
  };
  const insertOrder = (key: string, pickupDay: string) =>
    db().insert(order).values({ source: "phone", customerName: "Novák", pickupDay, totalCzk: 8, callId: ids[key] });

  await insertCall("oldPickup", "2026-09-28T09:00:00Z");
  await insertOrder("oldPickup", "2026-10-01"); // picked up 54 days ago → goes
  await insertCall("recentPickup", "2026-09-28T09:00:00Z");
  await insertOrder("recentPickup", "2026-11-20"); // called long ago, picked up 4 days ago → stays
  await insertCall("oldNoOrder", "2026-10-01T09:00:00Z"); // 54 days, no order → goes
  await insertCall("recentNoOrder", "2026-11-20T09:00:00Z"); // stays
  await db()
    .insert(orderDraft)
    .values({ channel: "phone", callId: ids.recentNoOrder, payload: {}, expiresAt: new Date("2026-11-23T00:00:00Z") });
  await db()
    .insert(rateLimit)
    .values({ key: "call:x", windowStart: new Date("2026-11-23T00:00:00Z"), count: 3 });
  await db()
    .insert(rateLimit)
    .values({ key: "call:x", windowStart: new Date("2026-11-24T01:30:00Z"), count: 1 });
});
afterAll(async () => env?.stop());

const transcriptOf = async (key: string) => {
  const { db } = await import("@/server/runtime");
  const { getCall } = await import("@bakery/db");
  return (await getCall(db(), ids[key]!))?.transcript;
};

describe("retention (FR-009, ADR-0008)", () => {
  it("refuses a request without the cron secret", async () => {
    const { GET } = await import("./retention/route");
    expect((await GET(new Request("http://localhost/api/cron/retention"))).status).toBe(401);
    expect(
      (await GET(new Request("http://localhost/api/cron/retention", { headers: { authorization: "Bearer wrong" } })))
        .status,
    ).toBe(401);
  });

  it("deletes transcripts 30 days after pickup (or after the call without an order), expired drafts and spent counters", async () => {
    const { runRetention } = await import("@/server/retention");
    expect(await runRetention(NOW)).toEqual({ transcripts: 2, drafts: 1, rateLimits: 1 });
    expect(await transcriptOf("oldPickup")).toBeNull();
    expect(await transcriptOf("oldNoOrder")).toBeNull();
    expect(await transcriptOf("recentPickup")).not.toBeNull();
    expect(await transcriptOf("recentNoOrder")).not.toBeNull();
  });

  it("runs through the route with the secret, and a second run finds nothing", async () => {
    const { GET } = await import("./retention/route");
    const res = await GET(
      new Request("http://localhost/api/cron/retention", { headers: { authorization: "Bearer test-cron-secret" } }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ transcripts: 0, drafts: 0 });
  });
});
