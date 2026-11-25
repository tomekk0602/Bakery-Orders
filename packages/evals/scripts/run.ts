import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { AGENT_FINGERPRINT, PROMPT_VERSION } from "@bakery/core";
import type { Evalite } from "evalite/types";
import { type Baseline, type CaseResult, caseKey, compare, selectionFrom } from "../src/gate.ts";
import { EVAL_AGENT_MODEL } from "../src/model.ts";
import { passAtK, passHatK, wilson } from "../src/stats.ts";

/**
 * `npm run eval` runs the suites and prints pass rates with 95% intervals.
 *   --gate                   compare with baseline.json; exit 1 on a regression, 2 on missing evidence
 *   --update-baseline "why"  store this run as the new baseline (an explicit commit, ADR-0012)
 */
const args = process.argv.slice(2);
const gate = args.includes("--gate");
const updateIdx = args.indexOf("--update-baseline");
const why = updateIdx >= 0 ? args[updateIdx + 1] : undefined;
if (updateIdx >= 0 && !why) throw new Error('--update-baseline needs a reason: --update-baseline "why"');

const root = new URL("../", import.meta.url);
const outDir = new URL("out/", root);
const resultsPath = new URL("results.json", outDir).pathname;
const baselinePath = new URL("baseline.json", root).pathname;
mkdirSync(outDir, { recursive: true });

const started = Date.now();
// A result from an earlier run must never be read as this run's.
rmSync(resultsPath, { force: true });
const evalite = spawnSync("npx", ["evalite", "run", "--outputPath", resultsPath], {
  cwd: root.pathname,
  stdio: "inherit",
  env: process.env,
});
if (evalite.error) throw evalite.error;
if (!existsSync(resultsPath)) {
  // Evalite itself failed (setup, Docker, a crash): no evidence, which is not a regression (exit 2).
  console.error(`evalite produced no results (exit ${String(evalite.status)}) — see the output above`);
  process.exit(2);
}

const output = JSON.parse(readFileSync(resultsPath, "utf8")) as Evalite.Exported.Output;
const results = summarise(output);
const trials = Number(process.env.EVAL_TRIALS ?? 5);
const report = render(results, Date.now() - started);
console.log(report);
writeFileSync(new URL("report.md", outDir), report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report);

if (why) {
  const baseline: Baseline = {
    promptVersion: PROMPT_VERSION,
    fingerprint: AGENT_FINGERPRINT,
    model: EVAL_AGENT_MODEL,
    trialsPerCase: trials,
    recordedAt: new Date().toISOString().slice(0, 10),
    why,
    cases: Object.fromEntries(
      results.map((r) => [caseKey(r), { passed: r.passed, trials: r.trials - r.errors, gate: r.gate }]),
    ),
  };
  if (results.some((r) => r.errors > 0)) throw new Error("not storing a baseline from a run with errored trials");
  writeFileSync(baselinePath, JSON.stringify(baseline, null, 2) + "\n");
  console.log(`baseline.json updated: ${why}`);
}

if (gate) {
  const baseline = JSON.parse(readFileSync(baselinePath, "utf8")) as Baseline;
  if (baseline.fingerprint !== AGENT_FINGERPRINT)
    console.log(`agent changed since the baseline (${baseline.promptVersion} → ${PROMPT_VERSION})`);
  const verdict = compare(results, baseline, { selection: selectionFrom(process.env.EVAL_CASES) });
  const lines = [
    `\n## Gate: ${verdict.ok ? "PASS" : "FAIL"}\n`,
    ...verdict.infrastructure.map((l) => `- infrastructure: ${l}`),
    ...verdict.regressions.map((l) => `- regression: ${l}`),
    ...verdict.notes.map((l) => `- note: ${l}`),
  ].join("\n");
  console.log(lines);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines + "\n");
  if (verdict.infrastructure.length > 0) process.exit(2);
  if (!verdict.ok) process.exit(1);
}

/** Trials of one case grouped together: passed when every scorer gave 1, errored when nothing was scored. */
function summarise(out: Evalite.Exported.Output): CaseResult[] {
  const byCase = new Map<string, CaseResult>();
  for (const ev of out.evals) {
    for (const r of ev.results) {
      const input = r.input as { id: string; gate?: boolean };
      const key = `${ev.name}/${input.id}`;
      const c = byCase.get(key) ?? {
        suite: ev.name,
        id: input.id,
        gate: input.gate ?? false,
        trials: 0,
        passed: 0,
        errors: 0,
        failures: [],
      };
      c.trials += 1;
      if (r.scores.length === 0) c.errors += 1;
      else if (r.scores.every((s) => s.score === 1)) c.passed += 1;
      else
        c.failures.push(
          r.scores
            .filter((s) => s.score !== 1)
            .map((s) => `${s.name}: ${String(s.metadata)}`)
            .join("; "),
        );
      byCase.set(key, c);
    }
  }
  return [...byCase.values()];
}

function render(rows: CaseResult[], ms: number): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const header = [
    `# Agent evals — ${new Date().toISOString().slice(0, 16)}Z`,
    "",
    `Agent ${PROMPT_VERSION} (fingerprint ${AGENT_FINGERPRINT}), model \`${EVAL_AGENT_MODEL}\`, model default temperature for the customer agent and 0 for dictation, ${trials} trials per case, ${Math.round(ms / 1000)} s.`,
    "",
    "| case | gate | passed | rate | 95% interval | pass@k | pass^k | first failure |",
    "|---|---|---|---|---|---|---|---|",
  ];
  const body = rows.map((r) => {
    const n = r.trials - r.errors;
    const w = wilson(r.passed, n);
    const k = Math.max(1, n);
    const failure = (r.failures[0] ?? (r.errors ? `${r.errors} errored` : "")).replace(/\|/g, "/").slice(0, 140);
    return `| ${caseKey(r)} | ${r.gate ? "yes" : ""} | ${r.passed}/${n} | ${n ? pct(r.passed / n) : "-"} | ${pct(w.low)}–${pct(w.high)} | ${n ? pct(passAtK(r.passed, n, k)) : "-"} | ${n ? pct(passHatK(r.passed, n, k)) : "-"} | ${failure} |`;
  });
  const all = rows.reduce((a, r) => ({ p: a.p + r.passed, n: a.n + r.trials - r.errors }), { p: 0, n: 0 });
  const w = wilson(all.p, all.n);
  return [
    ...header,
    ...body,
    "",
    `All trials: ${all.p}/${all.n} (${pct(all.p / Math.max(1, all.n))}, 95% ${pct(w.low)}–${pct(w.high)}).`,
    "",
  ].join("\n");
}
