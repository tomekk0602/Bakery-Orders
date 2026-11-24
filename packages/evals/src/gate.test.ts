import { describe, expect, it } from "vitest";
import { type Baseline, type CaseResult, compare } from "./gate.ts";

const baseline: Baseline = {
  promptVersion: "test",
  fingerprint: "test",
  model: "test",
  trialsPerCase: 5,
  recordedAt: "2026-11-24",
  why: "test",
  cases: {
    "customer/u01": { passed: 5, trials: 5, gate: true },
    "customer/d06": { passed: 4, trials: 5, gate: false },
  },
};
const result = (id: string, passed: number, extra: Partial<CaseResult> = {}): CaseResult => ({
  suite: "customer",
  id,
  gate: id === "u01",
  trials: 5,
  passed,
  errors: 0,
  failures: passed < 5 ? ["turn 1: date 2026-11-26"] : [],
  ...extra,
});

const full = { fullRun: true };

describe("the regression gate", () => {
  it("passes when gate cases pass every trial and others hold their interval", () => {
    expect(compare([result("u01", 5), result("d06", 3)], baseline, full).ok).toBe(true);
  });

  it("fails a gate case that misses a single trial (pass^k)", () => {
    const v = compare([result("u01", 4), result("d06", 4)], baseline, full);
    expect(v.ok).toBe(false);
    expect(v.regressions[0]).toContain("customer/u01: 4/5");
  });

  it("fails a non-gate case below the lower bound of its baseline interval", () => {
    // baseline 4/5 → Wilson lower bound 0.38; 1/5 = 0.2 is below it
    const v = compare([result("u01", 5), result("d06", 1)], baseline, full);
    expect(v.regressions).toHaveLength(1);
    expect(v.regressions[0]).toContain("customer/d06");
  });

  it("does not pass on missing evidence: errored trials and dropped cases fail", () => {
    const errored = compare([result("u01", 3, { errors: 2 }), result("d06", 4)], baseline, full);
    expect(errored.ok).toBe(false);
    expect(errored.infrastructure[0]).toContain("2 of 5 trials errored");
    expect(errored.regressions).toEqual([]);
    expect(compare([result("u01", 5)], baseline, full).regressions).toEqual([
      "customer/d06: in the baseline but not run",
    ]);
  });

  it("notes a new case without failing on it", () => {
    const v = compare([result("u01", 5), result("d06", 4), { ...result("d99", 2), gate: false }], baseline, full);
    expect(v.ok).toBe(true);
    expect(v.notes).toEqual(["customer/d99: not in the baseline, not compared"]);
  });

  it("a subset run (EVAL_CASES) does not count the cases it skipped", () => {
    expect(compare([result("u01", 5)], baseline, { fullRun: false }).ok).toBe(true);
  });
});
