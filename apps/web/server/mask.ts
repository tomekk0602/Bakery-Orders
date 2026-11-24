/** What replaces a masked value in a trace. */
export const MASKED = "[masked]";

/** A key that holds a person's name or phone number, in both casings our payloads use; product names stay. */
const PERSONAL_KEY = /^(customer|caller)_?(name|phone)$/i;

/** Nine or more digits, optionally with spaces and a leading +: a phone number written anywhere. */
const PHONE = /\+?\d(?:[\d ]{7,})\d/g;

/**
 * Masks names and phone numbers before a trace leaves the server (FR-032, ADR-0013): every value under
 * a name or phone key, and every phone-like number in any string. Free text that could hold a name —
 * the transcript, the staff sentence — is never put into a trace at all (research R27).
 */
export function maskPersonalData(data: unknown): unknown {
  // The SDK hands input and output over already serialised: a JSON string is masked as what it holds.
  if (typeof data === "string")
    return isJson(data) ? JSON.stringify(maskPersonalData(JSON.parse(data))) : data.replace(PHONE, MASKED);
  if (Array.isArray(data)) return data.map(maskPersonalData);
  if (data && typeof data === "object") {
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [
        k,
        PERSONAL_KEY.test(k) && v !== null && v !== undefined ? MASKED : maskPersonalData(v),
      ]),
    );
  }
  return data;
}

function isJson(s: string): boolean {
  if (!/^\s*[[{]/.test(s)) return false;
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}
