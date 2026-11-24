import "server-only";
import { DICTATION_CONFIG, DICTATION_MODEL } from "@bakery/core";
import { genai } from "../runtime";

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
export async function extractOrder(input: {
  text: string;
  instructions: string;
  jsonSchema: Record<string, unknown>;
}): Promise<unknown> {
  let raw: string | undefined;
  try {
    const r = await genai().models.generateContent({
      model: DICTATION_MODEL,
      contents: input.text,
      config: { ...DICTATION_CONFIG, systemInstruction: input.instructions, responseJsonSchema: input.jsonSchema },
    });
    raw = r.text;
  } catch (e) {
    throw new DictationUnavailable(
      e instanceof Error && /quota|RESOURCE_EXHAUSTED|429/.test(e.message) ? "quota" : "provider",
      e,
    );
  }
  try {
    return JSON.parse(raw ?? "");
  } catch (e) {
    throw new DictationUnavailable("invalid_output", e);
  }
}
