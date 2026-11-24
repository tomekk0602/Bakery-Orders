import { defineConfig } from "evalite/config";

/** Trials per case (ADR-0012: N = 5, proposed). EVAL_TRIALS lowers it for a quick local look. */
const trials = Number(process.env.EVAL_TRIALS ?? 5);

export default defineConfig({
  trialCount: trials,
  // one case at a time: the request pacer spaces calls anyway, and parallel cases would only time out waiting
  maxConcurrency: 1,
  // a dialogue is up to 12 paced model calls of ~4 s each
  testTimeout: 5 * 60_000,
  hideTable: true,
});
