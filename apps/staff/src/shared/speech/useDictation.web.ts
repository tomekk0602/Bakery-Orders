import { useEffect, useRef, useState } from "react";
import type { Dictation } from "./useDictation";

// The Web Speech API is not in TypeScript's DOM library; this is the part we use.
type Result = { 0: { transcript: string }; isFinal: boolean };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<Result> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  const w = globalThis as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** The browser's speech recogniser in Czech (Chrome sends the audio to Google, ADR-0005). */
export function useDictation(): Dictation {
  const Ctor = recognitionCtor();
  const rec = useRef<Recognition | null>(null);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => rec.current?.stop(), []);

  const start = () => {
    if (!Ctor || listening) return;
    const r = new Ctor();
    r.lang = "cs-CZ";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => setText(Array.from(e.results, (x) => x[0].transcript).join(" "));
    r.onerror = (e) => setError(e.error);
    r.onend = () => setListening(false);
    rec.current = r;
    setError(null);
    setText("");
    setListening(true);
    r.start();
  };

  return { supported: Ctor !== null, listening, text, setText, error, start, stop: () => rec.current?.stop() };
}
