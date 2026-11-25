import "server-only";
import { percentile, pragueDate, PRICES_READ_ON } from "@bakery/core";
import { ProvozResponse } from "@bakery/core/contracts";
import { provozRows, pushFailures } from "@bakery/db";
import { db } from "../runtime";

const DAY_MS = 24 * 60 * 60 * 1000;
const OUTCOMES = ["order", "request", "abandoned", "capped", "error"] as const;

/**
 * "Provoz" for the last `days` days (FR-033, ADR-0013): call outcomes, end-of-speech → first-audio
 * latency over every measured turn, orders per channel, the shadow cost and failed device notifications (spec 002 FR-011). Latency percentiles are
 * nearest-rank over all samples of the period, not an average of per-call medians.
 */
export async function provoz(days: number, now = new Date()): Promise<ProvozResponse> {
  const from = new Date(now.getTime() - days * DAY_MS);
  const { calls, orders } = await provozRows(db(), from, now);

  const samples = calls.flatMap((c) => c.firstAudioMs ?? []);
  const outcomes = Object.fromEntries(OUTCOMES.map((o) => [o, calls.filter((c) => c.outcome === o).length])) as Record<
    (typeof OUTCOMES)[number],
    number
  >;
  const ordersBy = (s: "phone" | "web" | "staff") => orders.find((o) => o.source === s)?.n ?? 0;
  const shadowUsd = calls.reduce((s, c) => s + Number(c.shadowCostUsd ?? 0), 0);
  const ended = calls.filter((c) => c.endedAt !== null).length;
  const versions = new Map<string, number>();
  for (const c of calls) versions.set(c.promptVersion, (versions.get(c.promptVersion) ?? 0) + 1);

  return ProvozResponse.parse({
    period: { days, from: pragueDate(from), to: pragueDate(now) },
    calls: { total: calls.length, ...outcomes, open: calls.length - ended },
    firstAudio: { samples: samples.length, p50Ms: percentile(samples, 50), p95Ms: percentile(samples, 95) },
    orders: { phone: ordersBy("phone"), web: ordersBy("web"), staff: ordersBy("staff") },
    phoneCorrectedShare: null,
    cost: {
      shadowUsd,
      perCallUsd: ended ? shadowUsd / ended : null,
      perPhoneOrderUsd: ordersBy("phone") ? shadowUsd / ordersBy("phone") : null,
      pricesReadOn: PRICES_READ_ON,
    },
    notifications: { pushFailed: await pushFailures(db(), from, now) },
    promptVersions: [...versions].map(([version, n]) => ({ version, calls: n })).sort((a, b) => b.calls - a.calls),
  });
}
