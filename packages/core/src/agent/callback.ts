/**
 * Whether the agent's words promise that a person will call back (research R3, FR-008).
 *
 * Only future forms count — "zavolá vám", "ozve se", "zavoláme". An offer in the greeting ("může vám
 * zavolat kolega") is not a promise: the first live call (2026-11-24) raised a false callback request
 * when the check matched "zavolat" and "kolega". The word list is unmeasured; misses and false
 * alarms are counted by the eval suite.
 */
// Letter-aware word boundaries: `\b` treats "á" as a non-letter, so "Zavolá vám" would not match.
const PROMISE = /(?<!\p{L})(zavolá|zavoláme|ozve|ozveme|ozvou)(?!\p{L})/iu;

export const promisesCallback = (agentText: string): boolean => PROMISE.test(agentText);
