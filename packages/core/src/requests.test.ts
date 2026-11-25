import { describe, expect, it } from "vitest";
import { phoneKey, pragueDayStart } from "./requests.ts";

describe("pragueDayStart (FR-053)", () => {
  it("is midnight in Prague, winter and summer", () => {
    expect(pragueDayStart(new Date("2026-11-25T10:00:00Z")).toISOString()).toBe("2026-11-24T23:00:00.000Z");
    expect(pragueDayStart(new Date("2026-11-24T23:30:00Z")).toISOString()).toBe("2026-11-24T23:00:00.000Z");
    expect(pragueDayStart(new Date("2026-07-01T10:00:00Z")).toISOString()).toBe("2026-06-30T22:00:00.000Z");
  });
});

describe("phoneKey (spec 001 edge case, research R33)", () => {
  it("the same number written three ways is one key", () => {
    expect(phoneKey("+420 777 123 456")).toBe("777123456");
    expect(phoneKey("777123456")).toBe("777123456");
    expect(phoneKey("00420777123456")).toBe("777123456");
  });

  it("too short or missing is no key", () => {
    expect(phoneKey("12345")).toBeNull();
    expect(phoneKey(null)).toBeNull();
  });
});
