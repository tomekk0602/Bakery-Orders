import { CALL_OPENING } from "@bakery/core/opening";
import { GoogleGenAI, type LiveServerMessage, type Session } from "@google/genai";
import { openMicrophone, openSpeaker, SPEECH_RMS, type Microphone, type Speaker } from "./audio";
import { FirstAudioClock } from "./first-audio";

export type Turn = { role: "customer" | "agent"; text: string };
export type EndReason = "hangup" | "capped" | "error";
export type CallEvents = {
  onTranscript: (turns: Turn[]) => void;
  onStatus: (status: "connecting" | "live" | "ended", detail?: string) => void;
  /** When the assistant is on the line, with the call's length cap in seconds (FR-068). */
  onLive?: (capSeconds: number) => void;
  /** Once, whoever ended the call — the customer, the cap, the assistant or an error (FR-066). */
  onEnded?: (result: { reason: EndReason; orderNumbers: number[] }) => void;
};
type StartResponse = { call_id: string; token: string; model: string; cap_seconds: number };

/**
 * One browser call: the browser talks to Gemini Live with a one-use token locked to the bakery's
 * configuration, and forwards every tool call to our API, where the rules run (research R16).
 */
export class LiveCall {
  private session: Session | null = null;
  private mic: Microphone | null = null;
  private speaker: Speaker | null = null;
  private turns: Turn[] = [];
  private readonly firstAudio = new FirstAudioClock();
  /** Every usage report as sent; the server prices them (research R27: per response or cumulative is checked there). */
  private usage: NonNullable<LiveServerMessage["usageMetadata"]>[] = [];
  private capTimer: ReturnType<typeof setTimeout> | null = null;
  private ended = false;
  private endReason: EndReason = "hangup";
  private callId = "";

  constructor(private readonly events: CallEvents) {}

  /**
   * Opens the call step by step. The caller can hang up at any moment, also while this is still
   * connecting: after every wait the call checks whether it has ended meanwhile and then releases
   * what it opened, so the microphone is never left on (FR-058). A failed start releases everything.
   */
  async start(callerPhone: string): Promise<void> {
    this.events.onStatus("connecting");
    try {
      const res = await fetch("/api/call/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caller_phone: callerPhone }),
      });
      const body = (await res.json()) as StartResponse & { error?: { message: string } };
      if (!res.ok) throw new Error(body.error?.message ?? "Hovor se nepodařilo zahájit.");
      this.callId = body.call_id;
      // hung up while the call was being created: the server still learns it ended
      if (this.ended) return void this.report(this.endReason);

      this.speaker = openSpeaker();
      const ai = new GoogleGenAI({ apiKey: body.token, httpOptions: { apiVersion: "v1beta" } });
      this.session = await ai.live.connect({
        model: body.model,
        // Everything else is locked by the token on the server side (FR-036).
        config: {},
        callbacks: {
          onmessage: (m) => void this.onMessage(m),
          onerror: () => void this.end("error"),
          onclose: () => void this.end("hangup"),
        },
      });
      if (this.ended) return this.release();

      this.mic = await openMicrophone((data, rms) => {
        if (rms > SPEECH_RMS) this.firstAudio.speech(performance.now());
        this.session?.sendRealtimeInput({ audio: { data, mimeType: "audio/pcm;rate=16000" } });
      });
      if (this.ended) return this.release();

      // The agent speaks first: greeting with the AI notice (FR-001).
      this.session.sendClientContent({
        turns: [{ role: "user", parts: [{ text: CALL_OPENING }] }],
        turnComplete: true,
      });
      this.capTimer = setTimeout(() => void this.end("capped"), body.cap_seconds * 1000);
      this.events.onStatus("live");
      this.events.onLive?.(body.cap_seconds);
    } catch (e) {
      // a refused microphone or a failed connection: nothing stays open, and the call is ended on the server
      if (!this.ended) {
        this.ended = true;
        this.release();
        void this.report("error");
      }
      throw e;
    }
  }

  /** Stops everything the call opened; safe to call more than once. */
  private release(): void {
    if (this.capTimer) clearTimeout(this.capTimer);
    this.capTimer = null;
    this.mic?.stop();
    this.mic = null;
    this.session?.close();
    this.session = null;
    this.speaker?.close();
    this.speaker = null;
  }

  private append(role: Turn["role"], text: string) {
    const last = this.turns.at(-1);
    if (last && last.role === role) last.text += text;
    else this.turns.push({ role, text });
    this.events.onTranscript([...this.turns]);
  }

  private async onMessage(m: LiveServerMessage) {
    if (m.usageMetadata) this.usage.push(m.usageMetadata);
    const sc = m.serverContent;
    if (sc?.interrupted) {
      this.speaker?.interrupt();
      this.firstAudio.agentTurnEnded();
    }
    for (const part of sc?.modelTurn?.parts ?? []) {
      const data = part.inlineData?.data;
      if (!data) continue;
      this.firstAudio.agentAudio(performance.now());
      this.speaker?.play(data);
    }
    if (sc?.turnComplete) this.firstAudio.agentTurnEnded();
    if (sc?.inputTranscription?.text) this.append("customer", sc.inputTranscription.text);
    if (sc?.outputTranscription?.text) this.append("agent", sc.outputTranscription.text);

    const calls = m.toolCall?.functionCalls ?? [];
    if (calls.length === 0) return;
    const functionResponses = await Promise.all(
      calls.map(async (fc) => {
        const r = await fetch(`/api/call/${this.callId}/tools/${fc.name}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(fc.args ?? {}),
        })
          .then((x) => x.json())
          .catch(() => ({ ok: false, reason: "network_error" }));
        return { id: fc.id, name: fc.name, response: r as Record<string, unknown> };
      }),
    );
    this.session?.sendToolResponse({ functionResponses });
  }

  async end(reason: EndReason): Promise<number[]> {
    if (this.ended) return [];
    this.ended = true;
    this.endReason = reason;
    this.release();
    this.events.onStatus("ended", reason);
    return this.report(reason);
  }

  /**
   * Tells the server the call ended, with the transcript and measurements; the order numbers come back
   * and go to the screen through `onEnded`, whoever ended the call (FR-066).
   */
  private async report(reason: EndReason): Promise<number[]> {
    const numbers = await this.sendEnd(reason);
    this.events.onEnded?.({ reason, orderNumbers: numbers });
    return numbers;
  }

  private async sendEnd(reason: EndReason): Promise<number[]> {
    if (!this.callId) return [];
    const r = await fetch(`/api/call/${this.callId}/end`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reason,
        transcript: this.turns,
        first_audio_ms: this.firstAudio.samples,
        usage: this.usage,
      }),
    })
      .then((x) => x.json() as Promise<{ order_numbers?: number[] }>)
      .catch(() => ({ order_numbers: [] }));
    return r.order_numbers ?? [];
  }
}
