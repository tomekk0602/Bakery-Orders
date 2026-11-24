import { describe, expect, it } from "vitest";
import { promisesCallback } from "./callback.ts";

describe("promisesCallback", () => {
  it.each([
    "Rozumím. Někdo z pekárny se vám brzy ozve.",
    "Samozřejmě! Zavolá vám kolega z pekárny.",
    "Zavoláme vám zítra dopoledne.",
  ])("detects a promise: %s", (text) => expect(promisesCallback(text)).toBe(true));

  it.each([
    // the greeting of the first live call, which raised a false request
    "Dobrý den, Pekárna U Lípy, tady automatický asistent. Rád vám zarezervuju pečivo, nebo vám může zavolat kolega. Co si přejete?",
    "Vaše objednávka je potvrzena, číslo objednávky je 1001.",
    "Chcete, aby vám kolega zavolal?",
  ])("does not count an offer or a question: %s", (text) => expect(promisesCallback(text)).toBe(false));
});
