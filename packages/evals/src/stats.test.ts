import { describe, expect, it } from "vitest";
import { passAtK, passHatK, wilson } from "./stats.ts";

describe("wilson", () => {
  it("matches the published interval for 5/5 and 0/5", () => {
    // 5/5 → [0.566, 1], 0/5 → [0, 0.434] (Wilson score, z = 1.96)
    expect(wilson(5, 5).low).toBeCloseTo(0.566, 3);
    expect(wilson(5, 5).high).toBe(1);
    expect(wilson(0, 5).high).toBeCloseTo(0.434, 3);
    expect(wilson(0, 5).low).toBe(0);
  });

  it("is centred near the rate and narrows with more trials", () => {
    const small = wilson(8, 10);
    const large = wilson(80, 100);
    expect(small.low).toBeCloseTo(0.49, 2);
    expect(small.high).toBeCloseTo(0.943, 2);
    expect(large.high - large.low).toBeLessThan(small.high - small.low);
  });

  it("says nothing without trials", () => {
    expect(wilson(0, 0)).toEqual({ low: 0, high: 1 });
  });
});

describe("pass@k and pass^k", () => {
  it("with k = n they are 'any passed' and 'all passed'", () => {
    expect(passAtK(1, 5, 5)).toBe(1);
    expect(passAtK(0, 5, 5)).toBe(0);
    expect(passHatK(5, 5, 5)).toBe(1);
    expect(passHatK(4, 5, 5)).toBe(0);
  });

  it("with k = 1 both are the pass rate", () => {
    expect(passAtK(3, 5, 1)).toBeCloseTo(0.6);
    expect(passHatK(3, 5, 1)).toBeCloseTo(0.6);
  });

  it("estimates k < n without bias", () => {
    // 3 of 5 passed: P(both of 2 drawn pass) = C(3,2)/C(5,2) = 0.3; P(at least one) = 1 - C(2,2)/C(5,2) = 0.9
    expect(passHatK(3, 5, 2)).toBeCloseTo(0.3);
    expect(passAtK(3, 5, 2)).toBeCloseTo(0.9);
  });

  it("refuses k larger than the trials", () => {
    expect(() => passAtK(1, 2, 3)).toThrow();
  });
});
