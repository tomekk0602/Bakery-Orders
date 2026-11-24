import { setTimeout as sleep } from "node:timers/promises";
import { DICTATION_MODEL } from "@bakery/core";
import { type GenerateContentParameters, type GenerateContentResponse, GoogleGenAI } from "@google/genai";

/**
 * The customer agent is evaluated in text on the dictation model: the Live model takes audio only and
 * has no request-per-day free tier to repeat runs on (ADR-0011). It tests the instructions, tools and
 * rules — what the agent decides — not the voice; the voice has its own eval (T069, research R24).
 */
export const EVAL_AGENT_MODEL = DICTATION_MODEL;

/** Free tier: 15 requests a minute (research R10). Requests are spaced, never fired in bursts. */
const MIN_GAP_MS = Math.ceil(60_000 / 15) + 100;

/** Daily or per-minute quota gone: the run stops loudly instead of grading silence as a failure. */
export class QuotaExhausted extends Error {
  override name = "QuotaExhausted";
}

let client: GoogleGenAI | undefined;
let nextSlot = 0;

export async function generate(params: GenerateContentParameters): Promise<GenerateContentResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set — evals call the real model");
  client ??= new GoogleGenAI({ apiKey, httpOptions: { retryOptions: { attempts: 3 } } });

  const now = Date.now();
  const slot = Math.max(now, nextSlot);
  nextSlot = slot + MIN_GAP_MS;
  if (slot > now) await sleep(slot - now);

  try {
    return await client.models.generateContent(params);
  } catch (e) {
    if (e instanceof Error && /RESOURCE_EXHAUSTED|quota|429/.test(e.message))
      throw new QuotaExhausted(e.message, { cause: e });
    throw e;
  }
}

/** A deliberate regression for testing the gate itself (ADR-0012): the calendar rows are cut from the prompt. */
export function applyAblation(instructions: string): string {
  if (process.env.EVAL_ABLATION !== "no-calendar") return instructions;
  return instructions
    .split("\n")
    .filter((l) => !/^\d{4}-\d{2}-\d{2} /.test(l))
    .join("\n");
}
