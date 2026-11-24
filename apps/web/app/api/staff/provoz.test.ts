import { ProvozResponse } from "@bakery/core/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { request, startStaffDb } from "@/test/staff-db";

let env: Awaited<ReturnType<typeof startStaffDb>>;

beforeAll(async () => {
  env = await startStaffDb();
  const { createCall, endCall } = await import("@bakery/db");
  const { db } = await import("@/server/runtime");
  const call = () => createCall(db(), { callerPhone: "+420777000111", ipHash: "t", promptVersion: "v1", model: "m" });
  const end = (id: string, outcome: "order" | "abandoned", firstAudioMs: number[], cost: number) =>
    endCall(db(), id, {
      outcome,
      transcript: [],
      firstAudioMs,
      tokensIn: 0,
      tokensOut: 0,
      shadowCostUsd: cost,
      traceId: null,
    });
  // ten samples over two calls; one call still open
  await end(await call(), "order", [900, 1200, 1500, 1800, 2000], 0.012);
  await end(await call(), "abandoned", [2100, 2600, 3300, 4100, 5200], 0.008);
  await call();
});
afterAll(async () => env?.stop());

const provoz = async (query: string, cookie?: string) => {
  const { GET } = await import("./provoz/route");
  return GET(request(`/api/staff/provoz${query}`, cookie ? { cookie } : {}));
};

describe("Provoz (FR-033)", () => {
  it("is the owner's: 401 without a session, 403 for an employee", async () => {
    expect((await provoz("")).status).toBe(401);
    expect((await provoz("", env.cookies.employee)).status).toBe(403);
  });

  it("counts outcomes and takes latency percentiles over every sample, not per-call medians", async () => {
    const body = ProvozResponse.parse(await (await provoz("?days=7", env.cookies.owner)).json());
    expect(body.calls).toMatchObject({ total: 3, order: 1, abandoned: 1, open: 1 });
    expect(body.firstAudio).toEqual({ samples: 10, p50Ms: 2000, p95Ms: 5200 });
    expect(body.cost.shadowUsd).toBeCloseTo(0.02);
    expect(body.cost.perCallUsd).toBeCloseTo(0.01); // over the two ended calls
    expect(body.promptVersions).toEqual([{ version: "v1", calls: 3 }]);
  });

  it("says the corrected share is not measured yet instead of reporting zero", async () => {
    const body = ProvozResponse.parse(await (await provoz("", env.cookies.owner)).json());
    expect(body.phoneCorrectedShare).toBeNull();
  });

  it("accepts only the offered periods", async () => {
    expect((await provoz("?days=30", env.cookies.owner)).status).toBe(200);
    expect((await provoz("?days=365", env.cookies.owner)).status).toBe(400);
  });
});
