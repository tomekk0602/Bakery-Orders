/**
 * The banner's sound in a browser (spec 002 FR-023, research N15): a short two-tone chime made with
 * the Web Audio API — no audio file, no library. Browsers keep audio silent until the page has been
 * clicked, so the context is resumed on the first touch or key press.
 */

const STORAGE_KEY = "bakery.notifications.sound";

/** Two rising tones, each 0.22 s, the second 0.16 s after the first; proposed, not measured. */
const TONES = [
  { frequencyHz: 880, startS: 0 },
  { frequencyHz: 1320, startS: 0.16 },
] as const;
const TONE_S = 0.22;
/** Loud enough over a busy counter, below clipping; proposed, not measured. */
const VOLUME = 0.25;
const SILENT = 0.0001;

export const soundSupported = typeof window !== "undefined" && "AudioContext" in window;

let context: AudioContext | null = null;
const audio = () => (context ??= new AudioContext());

/**
 * The per-device switch, on by default. Local storage can be unavailable (private mode, blocked site
 * data); the sound then stays on for this page's life, which is the default anyway.
 */
export function isSoundOn(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // not remembered across reloads; the switch still works for this page
  }
}

export function unlockSoundOnFirstTouch(): void {
  if (!soundSupported) return;
  const unlock = () => void audio().resume();
  window.addEventListener("pointerdown", unlock, { once: true });
  window.addEventListener("keydown", unlock, { once: true });
}

export function playChime(): void {
  if (!soundSupported) return;
  const ctx = audio();
  // before any click the context stays suspended and nothing plays: the banner shows without sound
  void ctx.resume();
  const now = ctx.currentTime;
  for (const tone of TONES) {
    const start = now + tone.startS;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = tone.frequencyHz;
    gain.gain.setValueAtTime(SILENT, start);
    gain.gain.exponentialRampToValueAtTime(VOLUME, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(SILENT, start + TONE_S);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + TONE_S + 0.02);
  }
}
