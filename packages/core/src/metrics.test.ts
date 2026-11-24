import { describe, expect, it } from "vitest";
import { percentile } from "./metrics.ts";

describe("percentile (nearest rank)", () => {
  const xs = [2100, 900, 3300, 1500, 5200, 1800, 2600, 1200, 4100, 2000];

  it("gives measured values: median and p95 of ten samples", () => {
    expect(percentile(xs, 50)).toBe(2000);
    expect(percentile(xs, 95)).toBe(5200);
  });

  it("handles one sample and no samples", () => {
    expect(percentile([1700], 95)).toBe(1700);
    expect(percentile([], 50)).toBeNull();
  });

  it("refuses a percentile outside 0–100", () => {
    expect(() => percentile(xs, 120)).toThrow();
  });
});
