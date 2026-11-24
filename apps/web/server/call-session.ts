import "server-only";
import { buildCalendar, buildInstructions, buildToolSchemas, buildVocabulary, toolDeclarations } from "@bakery/core";
import type { Bakery } from "@bakery/db";
import { Modality, type LiveConnectConfig } from "@google/genai";

/** The Live configuration the call token is locked to (research R16, FR-036). */
export function liveConfig(bakery: Bakery, now: Date): LiveConnectConfig {
  const calendar = buildCalendar(now, bakery.schedule);
  const schemas = buildToolSchemas(bakery.catalogue, calendar);
  return {
    responseModalities: [Modality.AUDIO],
    speechConfig: { languageCode: "cs-CZ" },
    systemInstruction: {
      parts: [
        {
          text: buildInstructions({ mode: "customer", bakeryName: bakery.name, calendar, catalogue: bakery.catalogue }),
        },
      ],
    },
    tools: [{ functionDeclarations: toolDeclarations(schemas, "customer") }],
    inputAudioTranscription: {
      languageCodes: ["cs-CZ"],
      customVocabulary: buildVocabulary(bakery.catalogue, bakery.name),
    },
    outputAudioTranscription: {},
  };
}

/** Per-IP limit on starting calls: 5 per 10 minutes. Proposed values, unmeasured (ADR-0014). */
export const CALL_START_LIMIT = { max: 5, windowMs: 10 * 60 * 1000 };

/** Extra time after the cap for the last tool calls and the end request. */
export const CALL_GRACE_MS = 60 * 1000;
