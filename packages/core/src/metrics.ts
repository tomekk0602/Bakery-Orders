/**
 * Nearest-rank percentile (p in 0–100) of a sample: the smallest value with at least p% of the sample
 * at or below it. Always a measured value, never an interpolated one; null for an empty sample.
 */
export function percentile(xs: readonly number[], p: number): number | null {
  if (p < 0 || p > 100) throw new Error(`percentile: p=${p} outside 0–100`);
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[rank - 1] ?? null;
}
