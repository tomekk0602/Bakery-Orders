import { describe, expect, it } from "vitest";
import { Phone } from "./new-order.ts";
import { IsoDate } from "./orders.ts";

describe("input is checked for what it means, not only its shape (spec 001 FR-063)", () => {
  it("a day must exist in the calendar", () => {
    expect(IsoDate.safeParse("2026-11-26").success).toBe(true);
    expect(IsoDate.safeParse("2028-02-29").success).toBe(true); // a leap year
    for (const bad of ["2026-99-99", "2026-02-30", "2027-02-29", "2026-13-01", "26-11-2026"])
      expect(IsoDate.safeParse(bad).success).toBe(false);
  });

  it("a phone number has 9 to 15 digits once spaces are dropped", () => {
    expect(Phone.parse(" +420 777 123 456 ")).toBe("+420777123456");
    expect(Phone.parse("777123456")).toBe("777123456");
    for (const bad of ["1        2", "12345678", "+1234567890123456", "777-123-456", "+"])
      expect(Phone.safeParse(bad).success).toBe(false);
  });
});
