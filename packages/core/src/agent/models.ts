/** The customer call model (ADR-0011, research R12). */
export const LIVE_MODEL = "gemini-3.8-live";

/** The staff dictation model (ADR-0011): free tier, 15 requests a minute and 500 a day (research R10). */
export const DICTATION_MODEL = "gemini-3.5-flash-lite";

/** Generation settings of the dictation call, shared by the server and the evals so both test one thing. */
export const DICTATION_CONFIG = { responseMimeType: "application/json", temperature: 0 } as const;
