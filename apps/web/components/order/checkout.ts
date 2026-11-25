import type { WebOrderPlaced, WebOrderReview } from "@bakery/core/contracts";

/**
 * Where the checkout is. An unknown confirmation result belongs to the review it was about: the
 * review stays locked until it is confirmed, and the lock goes with it (spec 001 FR-065, FR-078).
 */
export type Step =
  | { kind: "form" }
  | { kind: "preview"; preview: WebOrderReview; uncertain: boolean }
  | { kind: "placed"; placed: WebOrderPlaced };

/** A failed confirmation; when its result is unknown, only confirming the same review again is safe. */
export const confirmFailed = (step: Step, unknown: boolean): Step =>
  step.kind === "preview" ? { ...step, uncertain: unknown } : step;

/** Whether the selection, the day and editing are closed. */
export const isLocked = (step: Step, busy: boolean): boolean =>
  busy || step.kind === "placed" || (step.kind === "preview" && step.uncertain);
