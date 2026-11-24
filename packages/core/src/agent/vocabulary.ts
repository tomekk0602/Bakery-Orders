import { activeProducts, type Product } from "../catalogue.ts";

/**
 * Upper bound on vocabulary phrases. A vocabulary helps product names (research R12: "kaiserek"
 * fixed) but can over-correct other words (Slovak "päť" became "50"), so it is kept to product
 * names and their forms. The number itself is unmeasured — debt (constitution IV).
 */
export const MAX_VOCABULARY = 60;

/** Fixed phrases the recognisers missed in measurements that are not product names. */
const EXTRA = ["pozítří"];

export function buildVocabulary(catalogue: readonly Product[], bakeryName: string): string[] {
  const phrases = activeProducts(catalogue).flatMap((p) => [p.name, ...p.spokenForms]);
  return [...new Set([...phrases, ...EXTRA, bakeryName])].slice(0, MAX_VOCABULARY);
}
