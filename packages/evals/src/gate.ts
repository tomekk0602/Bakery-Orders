import { wilson } from "./stats.ts";

/** One case over all its trials. `errors` are trials that never reached grading (provider down, quota). */
export type CaseResult = {
  suite: string;
  id: string;
  gate: boolean;
  trials: number;
  passed: number;
  errors: number;
  failures: string[];
};

export type Baseline = {
  promptVersion: string;
  fingerprint: string;
  model: string;
  trialsPerCase: number;
  recordedAt: string;
  why: string;
  cases: Record<string, { passed: number; trials: number; gate: boolean }>;
};

export type GateVerdict = { ok: boolean; infrastructure: string[]; regressions: string[]; notes: string[] };

export const caseKey = (r: Pick<CaseResult, "suite" | "id">) => `${r.suite}/${r.id}`;

/**
 * The regression gate (ADR-0012): a gate case must pass in every trial (pass^k); any other case must
 * not fall below the lower bound of its baseline interval. Trials that errored are reported apart —
 * a quota failure is not a regression, but the gate does not pass on missing evidence either.
 */
export function compare(results: readonly CaseResult[], baseline: Baseline, opts: { fullRun: boolean }): GateVerdict {
  const infrastructure: string[] = [];
  const regressions: string[] = [];
  const notes: string[] = [];
  const seen = new Set<string>();

  for (const r of results) {
    const key = caseKey(r);
    seen.add(key);
    if (r.errors > 0) infrastructure.push(`${key}: ${r.errors} of ${r.trials} trials errored`);
    const graded = r.trials - r.errors;
    if (graded === 0) continue;
    if (r.gate && r.passed < graded) {
      regressions.push(`${key}: ${r.passed}/${graded}, a gate case must pass every trial — ${r.failures[0] ?? ""}`);
      continue;
    }
    const base = baseline.cases[key];
    if (!base) {
      notes.push(`${key}: not in the baseline, not compared`);
      continue;
    }
    const floor = wilson(base.passed, base.trials).low;
    if (r.passed / graded < floor)
      regressions.push(
        `${key}: ${r.passed}/${graded} is below the baseline's lower bound ${floor.toFixed(2)} (${base.passed}/${base.trials}) — ${r.failures[0] ?? ""}`,
      );
  }
  // A dropped case is missing evidence only when everything was meant to run (not with EVAL_CASES).
  if (opts.fullRun)
    for (const key of Object.keys(baseline.cases))
      if (!seen.has(key)) regressions.push(`${key}: in the baseline but not run`);

  return { ok: infrastructure.length === 0 && regressions.length === 0, infrastructure, regressions, notes };
}
