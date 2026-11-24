/** What the call page sends when the line opens, so the agent speaks first (FR-001). */
export const CALL_OPENING = "(Zákazník se připojil.)";

/** The greeting the instructions require word for word: the AI notice and the offer of a person (FR-001). */
export const greeting = (bakeryName: string) =>
  `Dobrý den, ${bakeryName}, tady automatický asistent. Rád vám zarezervuju pečivo, nebo vám může zavolat kolega. Co si přejete?`;
