import type { WebOrderPlaced, WebOrderReview } from "@bakery/core/contracts";
import { describe, expect, it } from "vitest";
import { confirmFailed, isLocked, type Step } from "./checkout";

const preview = { draftId: "d", token: "t" } as unknown as WebOrderReview;
const placed = { orderNumber: 1042 } as unknown as WebOrderPlaced;

describe("the web checkout after a lost answer (spec 001 FR-065, FR-078)", () => {
  it("lost answer → retry succeeds → 'Nová objednávka': the form can be used again", () => {
    let step: Step = { kind: "preview", preview, uncertain: false };
    step = confirmFailed(step, true);
    expect(isLocked(step, false)).toBe(true); // editing would make a new order
    step = { kind: "placed", placed }; // the retry returned the saved order
    expect(isLocked(step, false)).toBe(true);
    step = { kind: "form" }; // "Nová objednávka"
    expect(isLocked(step, false)).toBe(false);
  });

  it("a clear refusal leaves the review editable", () => {
    const step = confirmFailed({ kind: "preview", preview, uncertain: false }, false);
    expect(isLocked(step, false)).toBe(false);
  });
});
