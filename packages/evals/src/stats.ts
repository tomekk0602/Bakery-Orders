/** z for a two-sided 95% interval. */
const Z95 = 1.959964;

/**
 * Wilson score interval for `passed` out of `trials` (Wilson 1927). Unlike the normal approximation it
 * stays inside [0, 1] and is meaningful at 0/5 and 5/5, which is where small eval runs live.
 */
export function wilson(passed: number, trials: number, z = Z95): { low: number; high: number } {
  if (trials === 0) return { low: 0, high: 1 };
  const p = passed / trials;
  const z2 = z * z;
  const centre = (p + z2 / (2 * trials)) / (1 + z2 / trials);
  const half = (z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials))) / (1 + z2 / trials);
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** Chance that at least one of k runs passes, estimated without bias from n trials (Chen et al. 2021). */
export function passAtK(passed: number, trials: number, k: number): number {
  if (k > trials) throw new Error(`passAtK: k=${k} > trials=${trials}`);
  return 1 - choose(trials - passed, k) / choose(trials, k);
}

/** Chance that all k runs pass ("does it every time"), estimated from n trials (Yao et al. 2024, τ-bench). */
export function passHatK(passed: number, trials: number, k: number): number {
  if (k > trials) throw new Error(`passHatK: k=${k} > trials=${trials}`);
  return choose(passed, k) / choose(trials, k);
}
