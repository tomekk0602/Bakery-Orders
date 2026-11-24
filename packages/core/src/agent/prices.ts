import { DICTATION_MODEL, LIVE_MODEL } from "./models.ts";

/**
 * Paid-tier prices in USD per million tokens, for the shadow cost (ADR-0013): what a call or a
 * dictation would cost once the free tier is left. Thinking tokens are billed as output text.
 * Source: https://aistudio.google.com/docs/pricing (Standard tier), read 2026-11-24.
 */
export const PRICES_READ_ON = "2026-11-24";

type Price = { inputText: number; inputAudio: number; outputText: number; outputAudio: number };

export const PRICES_USD_PER_MTOK: Record<string, Price> = {
  [LIVE_MODEL]: { inputText: 0.75, inputAudio: 3.0, outputText: 4.5, outputAudio: 12.0 },
  // one input price for text, image, video and audio; output is text only
  [DICTATION_MODEL]: { inputText: 0.3, inputAudio: 0.3, outputText: 2.5, outputAudio: 2.5 },
};

/** Tokens by direction and modality — what the price table is keyed by. */
export type TokenUsage = { inputText: number; inputAudio: number; outputText: number; outputAudio: number };

export const NO_USAGE: TokenUsage = { inputText: 0, inputAudio: 0, outputText: 0, outputAudio: 0 };

/** The provider's usage metadata, structurally — the core does not depend on the SDK. */
export type ProviderUsage = {
  promptTokenCount?: number;
  responseTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  toolUsePromptTokenCount?: number;
  promptTokensDetails?: { modality?: string; tokenCount?: number }[];
  responseTokensDetails?: { modality?: string; tokenCount?: number }[];
  candidatesTokensDetails?: { modality?: string; tokenCount?: number }[];
};

const audioOf = (details: ProviderUsage["promptTokensDetails"]) =>
  (details ?? []).filter((d) => d.modality === "AUDIO").reduce((s, d) => s + (d.tokenCount ?? 0), 0);

/**
 * Splits one usage report into the price table's four buckets. Audio is what the details name as
 * AUDIO; everything else in the prompt (text, tool-use prompt) is input text; thinking is output text.
 */
export function usageFromProvider(u: ProviderUsage): TokenUsage {
  const prompt = (u.promptTokenCount ?? 0) + (u.toolUsePromptTokenCount ?? 0);
  const response = u.responseTokenCount ?? u.candidatesTokenCount ?? 0;
  const inputAudio = audioOf(u.promptTokensDetails);
  const outputAudio = audioOf(u.responseTokensDetails ?? u.candidatesTokensDetails);
  return {
    inputText: Math.max(0, prompt - inputAudio),
    inputAudio,
    outputText: Math.max(0, response - outputAudio) + (u.thoughtsTokenCount ?? 0),
    outputAudio,
  };
}

export const addUsage = (a: TokenUsage, b: TokenUsage): TokenUsage => ({
  inputText: a.inputText + b.inputText,
  inputAudio: a.inputAudio + b.inputAudio,
  outputText: a.outputText + b.outputText,
  outputAudio: a.outputAudio + b.outputAudio,
});

/** The cost on the paid tier, in USD. A model without a price is an error, never a silent zero. */
export function shadowCostUsd(model: string, u: TokenUsage): number {
  const p = PRICES_USD_PER_MTOK[model];
  if (!p) throw new Error(`shadowCostUsd: no price for ${model}`);
  return (
    (u.inputText * p.inputText +
      u.inputAudio * p.inputAudio +
      u.outputText * p.outputText +
      u.outputAudio * p.outputAudio) /
    1_000_000
  );
}
