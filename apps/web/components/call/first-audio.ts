/** Silence before the first reply audio counts from the last microphone chunk that held speech. */
const MAX_FIRST_AUDIO_MS = 60_000;

/**
 * End of the customer's speech → the agent's first audio, once per agent turn (FR-032).
 *
 * Only speech heard while the agent is silent counts. Without headphones the microphone hears the
 * agent's own voice from the speaker; counted as the customer's, the next chunk of the same reply
 * measured 2–68 ms on the first production call (research R28). An agent turn is open from its first
 * audio until it completes or the customer interrupts it.
 */
export class FirstAudioClock {
  private lastSpeechAt = 0;
  private awaitingReply = false;
  private agentSpeaking = false;
  readonly samples: number[] = [];

  /** A microphone chunk above the speech threshold, at time `now` (ms). */
  speech(now: number): void {
    if (this.agentSpeaking) return;
    this.lastSpeechAt = now;
    this.awaitingReply = true;
  }

  /** A chunk of the agent's audio arrived at `now`; the first one of a turn is measured. */
  agentAudio(now: number): void {
    if (this.awaitingReply && !this.agentSpeaking) {
      const ms = Math.round(now - this.lastSpeechAt);
      if (ms < MAX_FIRST_AUDIO_MS) this.samples.push(ms);
      this.awaitingReply = false;
    }
    this.agentSpeaking = true;
  }

  /** The agent's turn ended — completed, or cut off by the customer. */
  agentTurnEnded(): void {
    this.agentSpeaking = false;
  }
}
