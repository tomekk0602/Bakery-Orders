import "server-only";
import { genai } from "../runtime";

/** The staff dictation model (ADR-0011): free tier, 15 requests a minute and 500 a day (research R10). */
export const DICTATION_MODEL = "gemini-3.5-flash-lite";

/** The model could not be reached or gave nothing usable; the app then offers the form (FR-022). */
export class DictationUnavailable extends Error {
  constructor(
    readonly reason: "quota" | "provider" | "invalid_output",
    cause?: unknown,
  ) {
    super(`dictation unavailable: ${reason}`, { cause });
    this.name = "DictationUnavailable";
  }

  /** Recognised by name, so it holds across module copies (bundler chunks, test doubles). */
  static is(e: unknown): e is DictationUnavailable {
    return e instanceof Error && e.name === "DictationUnavailable" && "reason" in e;
  }
}

/** One call with the response constrained to the dictation JSON Schema (research R22). */
export async function extractOrder(input: { text: string; instructions: string; jsonSchema: Record<string, unknown> }): Promise<unknown> {
  let raw: string | undefined;
  try {
    const r = await genai().models.generateContent({
      model: DICTATION_MODEL,
      contents: input.text,
      config: { systemInstruction: input.instructions, responseMimeType: "application/json", responseJsonSchema: input.jsonSchema, temperature: 0 },
    });
    raw = r.text;
  } catch (e) {
    throw new DictationUnavailable(e instanceof Error && /quota|RESOURCE_EXHAUSTED|429/.test(e.message) ? "quota" : "provider", e);
  }
  try {
    return JSON.parse(raw ?? "");
  } catch (e) {
    throw new DictationUnavailable("invalid_output", e);
  }
}
