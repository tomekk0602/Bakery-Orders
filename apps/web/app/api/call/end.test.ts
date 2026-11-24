import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { request, startStaffDb } from "@/test/staff-db";

let env: Awaited<ReturnType<typeof startStaffDb>>;
beforeAll(async () => {
  env = await startStaffDb();
});
afterAll(async () => env?.stop());

const startCall = async () => {
  const { createCall } = await import("@bakery/db");
  const { db, ipHash } = await import("@/server/runtime");
  return createCall(db(), {
    callerPhone: "+420777000111",
    ipHash: ipHash(request("/")),
    promptVersion: "v",
    model: "m",
  });
};
const end = async (id: string, body: unknown) => {
  const { POST } = await import("./[id]/end/route");
  return POST(request(`/api/call/${id}/end`, { method: "POST", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id }),
  });
};
const stored = async (id: string) => {
  const { getCall } = await import("@bakery/db");
  const { db } = await import("@/server/runtime");
  return getCall(db(), id);
};

// Two Live usage reports: audio and text in, audio out (research R27).
const usage = [
  {
    promptTokenCount: 1000,
    responseTokenCount: 200,
    promptTokensDetails: [
      { modality: "TEXT", tokenCount: 800 },
      { modality: "AUDIO", tokenCount: 200 },
    ],
    responseTokensDetails: [{ modality: "AUDIO", tokenCount: 200 }],
  },
  {
    promptTokenCount: 1500,
    responseTokenCount: 300,
    promptTokensDetails: [
      { modality: "TEXT", tokenCount: 1100 },
      { modality: "AUDIO", tokenCount: 400 },
    ],
    responseTokensDetails: [{ modality: "AUDIO", tokenCount: 300 }],
  },
];

describe("call end (FR-009, FR-032, ADR-0013)", () => {
  it("stores the transcript, every first-audio sample, tokens, the shadow cost and the trace id", async () => {
    const id = await startCall();
    const res = await end(id, {
      reason: "hangup",
      transcript: [{ role: "agent", text: "Dobrý den" }],
      first_audio_ms: [2100, 1800, 3300],
      usage,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ outcome: "abandoned", order_numbers: [] });
    const c = await stored(id);
    expect(c?.firstAudioMs).toEqual([2100, 1800, 3300]);
    expect(c?.firstAudioMsP50).toBe(2100);
    expect(c?.firstAudioMsMax).toBe(3300);
    expect(c?.tokensIn).toBe(2500);
    expect(c?.tokensOut).toBe(500);
    // text in 1900 × 0.75 + audio in 600 × 3.00 + audio out 500 × 12.00, per million
    expect(Number(c?.shadowCostUsd)).toBeCloseTo((1900 * 0.75 + 600 * 3 + 500 * 12) / 1e6, 6);
    expect(c?.traceId).toMatch(/^[0-9a-f]{32}$/);
  });

  it("refuses a second end of the same call", async () => {
    const id = await startCall();
    await end(id, { reason: "hangup", transcript: [] });
    expect((await end(id, { reason: "hangup", transcript: [] })).status).toBe(404);
  });

  it("refuses malformed usage reports", async () => {
    const id = await startCall();
    expect((await end(id, { reason: "hangup", transcript: [], usage: [{ promptTokenCount: -5 }] })).status).toBe(400);
  });
});
