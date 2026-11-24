/**
 * Version of the agent definition (instructions, tool declarations, vocabulary). Written on every
 * order and trace (FR-030) and compared by the eval gate (ADR-0012).
 *
 * AGENT_FINGERPRINT is a hash of what the model actually receives for a fixed bakery and day; the
 * test in agent.test.ts fails when the output changes and the version was not bumped.
 */
export const PROMPT_VERSION = "2026-11-24.1";
export const AGENT_FINGERPRINT = "c58585966c4fc700";
