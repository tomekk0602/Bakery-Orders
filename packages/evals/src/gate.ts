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

/** What a run was meant to cover, as EVAL_CASES says: everything, the gate cases, or a list of ids. */
export type Selection = "all" | "gate" | readonly string[];

/** EVAL_CASES as a selection: unset → all, "gate" → the gate cases, otherwise comma-separated ids. */
export const selectionFrom = (env: string | undefined): Selection =>
  !env ? "all" : env === "gate" ? "gate" : env.split(",").map((s) => s.trim());

/** The baseline cases a run with this selection must have results for (spec 001 FR-080). */
function expectedKeys(baseline: Baseline, selection: Selection): string[] {
  return Object.entries(baseline.cases)
    .filter(([key, c]) =>
      selection === "all" ? true : selection === "gate" ? c.gate : selection.includes(key.slice(key.indexOf("/") + 1)),
    )
    .map(([key]) => key);
}

/**
 * The regression gate (ADR-0012): a gate case must pass in every trial (pass^k); any other case must
 * not fall below the lower bound of its baseline interval. Trials that errored are reported apart —
 * a quota failure is not a regression, but the gate does not pass on missing evidence either.
 */
export function compare(
  results: readonly CaseResult[],
  baseline: Baseline,
  opts: { selection: Selection },
): GateVerdict {
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
  // A case the run was meant to cover and has no result for is missing evidence, like a missing
  // report; an empty result set never passes (FR-080).
  for (const key of expectedKeys(baseline, opts.selection))
    if (!seen.has(key)) regressions.push(`${key}: in the baseline but not run`);
  if (results.length === 0) regressions.push("no results: the run produced no case at all");

  return { ok: infrastructure.length === 0 && regressions.length === 0, infrastructure, regressions, notes };
}
