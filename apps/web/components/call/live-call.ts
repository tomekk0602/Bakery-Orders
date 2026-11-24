import { CALL_OPENING } from "@bakery/core/opening";
import { GoogleGenAI, type LiveServerMessage, type Session } from "@google/genai";
import { openMicrophone, openSpeaker, SPEECH_RMS, type Microphone, type Speaker } from "./audio";

export type Turn = { role: "customer" | "agent"; text: string };
export type CallEvents = {
  onTranscript: (turns: Turn[]) => void;
  onStatus: (status: "connecting" | "live" | "ended", detail?: string) => void;
};
type StartResponse = { call_id: string; token: string; model: string; cap_seconds: number };

/** Silence before the first reply audio counts from the last microphone chunk that held speech. */
const MAX_FIRST_AUDIO_MS = 60_000;

/**
 * One browser call: the browser talks to Gemini Live with a one-use token locked to the bakery's
 * configuration, and forwards every tool call to our API, where the rules run (research R16).
 */
export class LiveCall {
  private session: Session | null = null;
  private mic: Microphone | null = null;
  private speaker: Speaker | null = null;
  private turns: Turn[] = [];
  private firstAudioMs: number[] = [];
  /** Every usage report as sent; the server prices them (research R27: per response or cumulative is checked there). */
  private usage: NonNullable<LiveServerMessage["usageMetadata"]>[] = [];
  private lastSpeechAt = 0;
  private awaitingReply = false;
  private capTimer: ReturnType<typeof setTimeout> | null = null;
  private ended = false;
  private callId = "";

  constructor(private readonly events: CallEvents) {}

  async start(callerPhone: string): Promise<void> {
    this.events.onStatus("connecting");
    const res = await fetch("/api/call/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ caller_phone: callerPhone }),
    });
    const body = (await res.json()) as StartResponse & { error?: { message: string } };
    if (!res.ok) throw new Error(body.error?.message ?? "Hovor se nepodařilo zahájit.");
    this.callId = body.call_id;

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
    this.mic = await openMicrophone((data, rms) => {
      if (rms > SPEECH_RMS) {
        this.lastSpeechAt = performance.now();
        this.awaitingReply = true;
      }
      this.session?.sendRealtimeInput({ audio: { data, mimeType: "audio/pcm;rate=16000" } });
    });
    // The agent speaks first: greeting with the AI notice (FR-001).
    this.session.sendClientContent({ turns: [{ role: "user", parts: [{ text: CALL_OPENING }] }], turnComplete: true });
    this.capTimer = setTimeout(() => void this.end("capped"), body.cap_seconds * 1000);
    this.events.onStatus("live");
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
    if (sc?.interrupted) this.speaker?.interrupt();
    for (const part of sc?.modelTurn?.parts ?? []) {
      const data = part.inlineData?.data;
      if (!data) continue;
      if (this.awaitingReply && this.lastSpeechAt) {
        const ms = Math.round(performance.now() - this.lastSpeechAt);
        if (ms < MAX_FIRST_AUDIO_MS) this.firstAudioMs.push(ms);
        this.awaitingReply = false;
      }
      this.speaker?.play(data);
    }
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

  async end(reason: "hangup" | "capped" | "error"): Promise<number[]> {
    if (this.ended) return [];
    this.ended = true;
    if (this.capTimer) clearTimeout(this.capTimer);
    this.mic?.stop();
    this.session?.close();
    this.speaker?.close();
    this.events.onStatus("ended", reason);
    if (!this.callId) return [];
    const r = await fetch(`/api/call/${this.callId}/end`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason, transcript: this.turns, first_audio_ms: this.firstAudioMs, usage: this.usage }),
    })
      .then((x) => x.json() as Promise<{ order_numbers?: number[] }>)
      .catch(() => ({ order_numbers: [] }));
    return r.order_numbers ?? [];
  }
}
