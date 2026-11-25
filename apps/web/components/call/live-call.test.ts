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
      connect: async () => {
        await mocks.connectGate.ready;
        return { close: mocks.sessionClose, sendClientContent: vi.fn(), sendRealtimeInput: vi.fn() };
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
    json: async () =>
      url === "/api/call/start"
        ? { call_id: "call-1", token: "t", model: "m", cap_seconds: 180 }
        : { order_numbers: [] },
  }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const ended = () => fetchMock.mock.calls.some(([url]) => url === "/api/call/call-1/end");
const tick = () => new Promise((r) => setTimeout(r, 0));

async function newCall() {
  const { LiveCall } = await import("./live-call");
  const statuses: string[] = [];
  const call = new LiveCall({ onTranscript: () => undefined, onStatus: (s) => statuses.push(s) });
  return { call, statuses };
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
