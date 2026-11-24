import { describe, expect, it } from "vitest";
import { DICTATION_MODEL, LIVE_MODEL } from "./models.ts";
import { addUsage, NO_USAGE, shadowCostUsd, usageFromProvider } from "./prices.ts";

describe("usage from the provider", () => {
  it("splits a Live report into audio and text by the modality details", () => {
    const u = usageFromProvider({
      promptTokenCount: 1200,
      responseTokenCount: 300,
      toolUsePromptTokenCount: 50,
      thoughtsTokenCount: 20,
      promptTokensDetails: [
        { modality: "TEXT", tokenCount: 1000 },
        { modality: "AUDIO", tokenCount: 200 },
      ],
      responseTokensDetails: [{ modality: "AUDIO", tokenCount: 300 }],
    });
    expect(u).toEqual({ inputText: 1050, inputAudio: 200, outputText: 20, outputAudio: 300 });
  });

  it("reads a generateContent report (candidates instead of response)", () => {
    expect(usageFromProvider({ promptTokenCount: 900, candidatesTokenCount: 60 })).toEqual({
      inputText: 900,
      inputAudio: 0,
      outputText: 60,
      outputAudio: 0,
    });
  });

  it("adds reports", () => {
    const one = { inputText: 1, inputAudio: 2, outputText: 3, outputAudio: 4 };
    expect(addUsage(addUsage(NO_USAGE, one), one)).toEqual({
      inputText: 2,
      inputAudio: 4,
      outputText: 6,
      outputAudio: 8,
    });
  });
});

describe("shadow cost", () => {
  it("prices a Live call by modality (USD per million tokens)", () => {
    // 1M of each: 0.75 + 3.00 + 4.50 + 12.00
    const m = 1_000_000;
    expect(shadowCostUsd(LIVE_MODEL, { inputText: m, inputAudio: m, outputText: m, outputAudio: m })).toBeCloseTo(
      20.25,
    );
  });

  it("prices a dictation", () => {
    expect(
      shadowCostUsd(DICTATION_MODEL, { inputText: 2000, inputAudio: 0, outputText: 100, outputAudio: 0 }),
    ).toBeCloseTo(0.00085);
  });

  it("refuses a model without a price instead of reporting zero", () => {
    expect(() => shadowCostUsd("unknown-model", NO_USAGE)).toThrow(/no price/);
  });
});
