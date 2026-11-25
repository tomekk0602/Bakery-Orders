import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { request, startStaffDb } from "@/test/staff-db";

// The voice service is outside our system: its token call is replaced, here refusing as when it is down.
vi.mock("@/server/runtime", async (original) => ({
  ...(await original<typeof import("@/server/runtime")>()),
  genai: () => ({ authTokens: { create: async () => Promise.reject(new Error("503 UNAVAILABLE")) } }),
}));
vi.mock("@/server/notifications/deliver", () => ({ alertAssistantDown: async () => undefined }));

let env: Awaited<ReturnType<typeof startStaffDb>>;
beforeAll(async () => {
  env = await startStaffDb();
});
afterAll(async () => env?.stop());

describe("a call whose start fails is recorded as an error (spec 001 FR-082)", () => {
  it("the voice service refuses the token: 503 for the page, the call ended with outcome error", async () => {
    const { POST } = await import("./start/route");
    const res = await POST(
      request("/api/call/start", { method: "POST", body: JSON.stringify({ caller_phone: "+420777000222" }) }),
    );
    expect(res.status).toBe(503);
    const { call } = await import("@bakery/db");
    const { db } = await import("@/server/runtime");
    const rows = await db().select({ outcome: call.outcome, endedAt: call.endedAt }).from(call);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.outcome).toBe("error");
    expect(rows[0]!.endedAt).not.toBeNull();
  });
});
