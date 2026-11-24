import { useState } from "react";

/**
 * Speech to text on the phone. Expo Go has no speech-recognition module (it needs a development
 * build), so on iOS and Android the staff dictate with the keyboard's own microphone into the text
 * field (research R22). The web build uses the browser's recogniser: useDictation.web.ts.
 */
export type Dictation = { supported: boolean; listening: boolean; text: string; setText: (t: string) => void; error: string | null; start: () => void; stop: () => void };


export function useDictation(): Dictation {
  const [text, setText] = useState("");
  return { supported: false, listening: false, text, setText, error: null, start: () => undefined, stop: () => undefined };
}
