import { afterEach, describe, expect, it, vi } from "vitest";
import { evalClient } from "./model.ts";

const perMinute429 = () =>
  new Response(
    JSON.stringify({ error: { code: 429, message: "Please retry in 24s.", status: "RESOURCE_EXHAUSTED" } }),
    {
      status: 429,
      headers: { "content-type": "application/json" },
    },
  );

const answer = () =>
  new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts: [{ text: "ok" }] } }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

afterEach(() => {
  vi.useRealTimers();
});

describe("evalClient retry (research R46)", () => {
  it("waits out a per-minute 429 before the second request", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(perMinute429()).mockResolvedValue(answer());
    const reply = evalClient("test-key", fetch).models.generateContent({ model: "m", contents: "hi" });

    await vi.advanceTimersByTimeAsync(24_000);
    expect(fetch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(36_000);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((await reply).text).toBe("ok");
  });
});
