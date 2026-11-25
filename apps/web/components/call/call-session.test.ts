import { describe, expect, it, vi } from "vitest";
import { CallSession, timeLeft } from "./call-session";
import type { CallEvents } from "./live-call";

/** A stand-in call whose events the test fires itself. */
function fakeCall(behaviour: { fail?: string } = {}) {
  let events!: CallEvents;
  const end = vi.fn(async () => [] as number[]);
  const start = vi.fn(async () => {
    if (behaviour.fail) throw new Error(behaviour.fail);
  });
  return {
    create: (e: CallEvents) => {
      events = e;
      return { start, end };
    },
    events: () => events,
    start,
    end,
  };
}

const session = (call: ReturnType<typeof fakeCall>, now = () => 1_000_000) =>
  new CallSession({ createCall: call.create, onChange: () => undefined, now });

describe("the call window's states (spec 001 FR-068)", () => {
  it("number → calling → live → ended with the order numbers", async () => {
    const call = fakeCall();
    const s = session(call);
    expect(s.view).toEqual({ step: "number", error: null });
    const starting = s.start("+420777123456");
    expect(s.view.step).toBe("calling");
    await starting;
    expect(call.start).toHaveBeenCalledWith("+420777123456");
    call.events().onLive?.(180);
    expect(s.view).toEqual({ step: "live", startedAt: 1_000_000, capSeconds: 180 });
    call.events().onTranscript([{ role: "agent", text: "Dobrý den" }]);
    expect(s.turns).toEqual([{ role: "agent", text: "Dobrý den" }]);
    call.events().onEnded?.({ reason: "capped", orderNumbers: [1042] });
    expect(s.view).toEqual({ step: "ended", reason: "capped", orderNumbers: [1042] });
  });

  it("a refusal goes back to the number with the server's reason (FR-016)", async () => {
    const call = fakeCall({ fail: "Hlasový asistent je teď vytížený. Objednejte prosím přes formulář." });
    const s = session(call);
    await s.start("+420777123456");
    expect(s.view).toEqual({
      step: "number",
      error: "Hlasový asistent je teď vytížený. Objednejte prosím přes formulář.",
    });
    call.events().onEnded?.({ reason: "error", orderNumbers: [] }); // the failed call's own report
    expect(s.view.step).toBe("number");
  });

  it("closing the window during a call ends the call; its late events change nothing (FR-070)", async () => {
    const call = fakeCall();
    const s = session(call);
    await s.start("+420777123456");
    call.events().onLive?.(180);
    s.close();
    expect(call.end).toHaveBeenCalledWith("hangup");
    expect(s.view).toEqual({ step: "number", error: null });
    call.events().onEnded?.({ reason: "hangup", orderNumbers: [1043] });
    call.events().onTranscript([{ role: "agent", text: "Na shledanou" }]);
    expect(s.view).toEqual({ step: "number", error: null });
    expect(s.turns).toEqual([]);
  });

  it("closing while still calling ends the call too", async () => {
    const call = fakeCall();
    const s = session(call);
    void s.start("+420777123456");
    s.close();
    expect(call.end).toHaveBeenCalledWith("hangup");
  });

  it("hang-up ends the call; a new call can start from the ended view", async () => {
    const first = fakeCall();
    const s = new CallSession({ createCall: (e) => first.create(e), onChange: () => undefined });
    await s.start("+420777123456");
    await s.hangUp();
    expect(first.end).toHaveBeenCalledWith("hangup");
    first.events().onEnded?.({ reason: "hangup", orderNumbers: [] });
    await s.start("+420777123456");
    expect(s.view.step).toBe("calling");
  });
});

describe("time left of the cap", () => {
  it("counts down in minutes and seconds and stops at zero", () => {
    const view = { step: "live" as const, startedAt: 0, capSeconds: 180 };
    expect(timeLeft(view, 0)).toBe("3:00");
    expect(timeLeft(view, 25_400)).toBe("2:35");
    expect(timeLeft(view, 999_000)).toBe("0:00");
  });
});
