import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The browser's audio and the voice service are outside the unit: each is a stand-in whose opening
// the test controls, so a hang-up can land between any two steps of the start.
const mocks = vi.hoisted(() => {
  const gate = () => {
    let open!: () => void;
    const ready = new Promise<void>((r) => (open = r));
    return { ready, open };
  };
  return {
    gate,
    micStop: vi.fn(),
    sessionClose: vi.fn(),
    speakerClose: vi.fn(),
    connectGate: gate(),
    micGate: gate(),
    micRefused: false,
    onmessage: ((_m: unknown) => undefined) as (m: unknown) => void,
  };
});
vi.mock("./audio", () => ({
  SPEECH_RMS: 0.02,
  openSpeaker: () => ({ play: vi.fn(), interrupt: vi.fn(), close: mocks.speakerClose }),
  openMicrophone: async () => {
    await mocks.micGate.ready;
    if (mocks.micRefused) throw new Error("Permission denied");
    return { stop: mocks.micStop };
  },
}));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    live = {
      connect: async (opts: { callbacks: { onmessage: (m: unknown) => void } }) => {
        mocks.onmessage = opts.callbacks.onmessage;
        await mocks.connectGate.ready;
        return {
          close: mocks.sessionClose,
          sendClientContent: vi.fn(),
          sendRealtimeInput: vi.fn(),
          sendToolResponse: vi.fn(),
        };
      },
    };
  },
}));

const fetchMock = vi.fn();
beforeEach(() => {
  mocks.micStop.mockReset();
  mocks.sessionClose.mockReset();
  mocks.speakerClose.mockReset();
  mocks.connectGate = mocks.gate();
  mocks.micGate = mocks.gate();
  mocks.micRefused = false;
  fetchMock.mockReset();
  fetchMock.mockImplementation(async (url: string) => ({
    ok: true,
    status: 200,
    json: async () =>
      url === "/api/call/start"
        ? { call_id: "call-1", token: "t", model: "m", cap_seconds: 180 }
        : { order_numbers: [1042] },
  }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const ended = () => fetchMock.mock.calls.some(([url]) => url === "/api/call/call-1/end");
const tick = () => new Promise((r) => setTimeout(r, 0));

async function newCall() {
  const { LiveCall } = await import("./live-call");
  const statuses: string[] = [];
  const results: { reason: string; orderNumbers: number[]; unknown: boolean }[] = [];
  const call = new LiveCall({
    onTranscript: () => undefined,
    onStatus: (s) => statuses.push(s),
    onEnded: (r) => results.push(r),
  });
  return { call, statuses, results };
}

describe("ending a call at any moment releases everything (spec 001 FR-058)", () => {
  it("hung up while the voice session connects: the microphone is never opened", async () => {
    const { call, statuses } = await newCall();
    const starting = call.start("+420777123456");
    await tick();
    await call.end("hangup");
    mocks.connectGate.open();
    mocks.micGate.open();
    await starting;
    expect(mocks.sessionClose).toHaveBeenCalled();
    expect(mocks.speakerClose).toHaveBeenCalled();
    expect(mocks.micStop).not.toHaveBeenCalled();
    expect(statuses).not.toContain("live");
    expect(ended()).toBe(true);
  });

  it("hung up while the microphone opens: it is stopped as soon as it is open", async () => {
    const { call, statuses } = await newCall();
    const starting = call.start("+420777123456");
    mocks.connectGate.open();
    await tick();
    await tick();
    await call.end("hangup");
    mocks.micGate.open();
    await starting;
    expect(mocks.micStop).toHaveBeenCalledTimes(1);
    expect(statuses).not.toContain("live");
  });

  it("a refused microphone closes the session and the speaker and ends the call on the server", async () => {
    mocks.micRefused = true;
    const { call } = await newCall();
    mocks.connectGate.open();
    mocks.micGate.open();
    await expect(call.start("+420777123456")).rejects.toThrow("Permission denied");
    expect(mocks.sessionClose).toHaveBeenCalled();
    expect(mocks.speakerClose).toHaveBeenCalled();
    await tick();
    expect(ended()).toBe(true);
  });

  it("a normal call goes live, and hanging up stops the microphone", async () => {
    const { call, statuses } = await newCall();
    mocks.connectGate.open();
    mocks.micGate.open();
    await call.start("+420777123456");
    expect(statuses.at(-1)).toBe("live");
    await call.end("hangup");
    expect(mocks.micStop).toHaveBeenCalledTimes(1);
    expect(ended()).toBe(true);
  });
});

describe("the saved orders reach the screen however the call ends (spec 001 FR-066, SC-018)", () => {
  it("the cap ends the call and the order numbers still come out, once", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const { call, results } = await newCall();
      mocks.connectGate.open();
      mocks.micGate.open();
      await call.start("+420777123456");
      await vi.advanceTimersByTimeAsync(180 * 1000);
      await vi.waitFor(() => expect(results).toEqual([{ reason: "capped", orderNumbers: [1042], unknown: false }]));
      await call.end("hangup"); // pressing hang-up afterwards changes nothing
      expect(results).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("the customer's hang-up reports the numbers the same way", async () => {
    const { call, results } = await newCall();
    mocks.connectGate.open();
    mocks.micGate.open();
    await call.start("+420777123456");
    await call.end("hangup");
    expect(results).toEqual([{ reason: "hangup", orderNumbers: [1042], unknown: false }]);
  });
});

describe("the call screen never says 'no order' when it cannot know (spec 001 FR-076, SC-022)", () => {
  const confirmOrder = { toolCall: { functionCalls: [{ id: "f1", name: "confirm_order", args: { draft_id: "d" } }] } };
  async function liveCall() {
    const c = await newCall();
    mocks.connectGate.open();
    mocks.micGate.open();
    await c.call.start("+420777123456");
    return c;
  }
  const answer = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body });

  it("a lost end report still shows the number the confirmation returned", async () => {
    const { call, results } = await liveCall();
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("/tools/confirm_order")
        ? answer({ ok: true, order_number: 1050 })
        : Promise.reject(new TypeError("offline")),
    );
    mocks.onmessage(confirmOrder);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await call.end("hangup");
    expect(results).toEqual([{ reason: "hangup", orderNumbers: [1050], unknown: false }]);
  });

  it("a lost end report with no confirmation seen is unknown, not 'no order'", async () => {
    const { call, results } = await liveCall();
    fetchMock.mockImplementation(async () => answer({ error: { message: "x" } }, false));
    await call.end("hangup");
    expect(results).toEqual([{ reason: "hangup", orderNumbers: [], unknown: true }]);
  });

  it("hanging up while an order is being confirmed waits for it and reports it", async () => {
    const { call, results } = await liveCall();
    const confirming = mocks.gate();
    const order: string[] = [];
    fetchMock.mockImplementation(async (url: string) => {
      order.push(url);
      if (url.endsWith("/tools/confirm_order")) {
        await confirming.ready;
        return answer({ ok: true, order_number: 1051 });
      }
      return answer({ order_numbers: order.includes("confirmed") ? [1051] : [] });
    });
    mocks.onmessage(confirmOrder);
    await tick();
    const ending = call.end("hangup");
    await tick();
    expect(order.some((u) => u.endsWith("/end"))).toBe(false); // the end report waits for the confirmation
    order.push("confirmed");
    confirming.open();
    await ending;
    expect(results).toEqual([{ reason: "hangup", orderNumbers: [1051], unknown: false }]);
  });
});
