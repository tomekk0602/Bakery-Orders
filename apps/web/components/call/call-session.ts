import type { CallEvents, EndReason, Turn } from "./live-call";

/** What the call window shows (spec 001 FR-068). */
export type CallView =
  | { step: "number"; error: string | null }
  | { step: "calling" }
  | { step: "live"; startedAt: number; capSeconds: number }
  | { step: "ended"; reason: EndReason; orderNumbers: number[]; unknown: boolean };

/** The part of `LiveCall` the window uses; a stand-in in tests. */
export type CallLike = { start(phone: string): Promise<void>; end(reason: EndReason): Promise<number[]> };

/**
 * The call window's state, apart from how it is drawn (research R39): it starts a call, follows it
 * through calling → live → ended, keeps the transcript, and ends the call when the window closes
 * (FR-070). A call that fails to start goes back to the number with the reason (FR-016).
 */
export class CallSession {
  view: CallView = { step: "number", error: null };
  turns: Turn[] = [];
  private call: CallLike | null = null;
  /** Each call gets its own number; events of an earlier call (closed, failed) change nothing. */
  private generation = 0;

  constructor(
    private readonly deps: {
      createCall: (events: CallEvents) => CallLike;
      onChange: () => void;
      now?: () => number;
    },
  ) {}

  private set(view: CallView) {
    this.view = view;
    this.deps.onChange();
  }

  async start(phone: string): Promise<void> {
    if (this.view.step !== "number" && this.view.step !== "ended") return;
    const gen = ++this.generation;
    const current = () => gen === this.generation;
    this.turns = [];
    this.set({ step: "calling" });
    const call = this.deps.createCall({
      onTranscript: (turns) => {
        if (!current()) return;
        this.turns = turns;
        this.deps.onChange();
      },
      onStatus: () => undefined,
      onLive: (capSeconds) => {
        if (current()) this.set({ step: "live", startedAt: (this.deps.now ?? Date.now)(), capSeconds });
      },
      onEnded: ({ reason, orderNumbers, unknown }) => {
        if (current()) this.set({ step: "ended", reason, orderNumbers, unknown });
      },
    });
    this.call = call;
    try {
      await call.start(phone);
    } catch (e) {
      if (!current()) return;
      // a call that never started shows its reason at the number, not as an ended call
      this.generation++;
      this.call = null;
      this.set({ step: "number", error: e instanceof Error ? e.message : "Hovor se nepodařilo zahájit." });
    }
  }

  async hangUp(): Promise<void> {
    await this.call?.end("hangup");
  }

  /** The window closes: a call in progress ends with it; the next opening starts at the number (FR-070). */
  close(): void {
    if (this.view.step === "calling" || this.view.step === "live") void this.call?.end("hangup");
    this.call = null;
    this.generation++; // the window is gone: no late event of that call redraws it
    this.turns = [];
    this.set({ step: "number", error: null });
  }
}

/** "2:35" left of the cap, never below zero (FR-068). */
export function timeLeft(view: Extract<CallView, { step: "live" }>, now: number): string {
  const left = Math.max(0, view.capSeconds - Math.floor((now - view.startedAt) / 1000));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}
