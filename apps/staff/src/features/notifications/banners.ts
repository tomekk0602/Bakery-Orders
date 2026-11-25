import type { NotificationList } from "@bakery/core/contracts";

export type BannerItem = NotificationList["items"][number];

/** How long a banner stays (owner, 2026-11-25; FR-021) — proposed, not measured. */
export const BANNER_MS = 30_000;
/** Banners shown at once; the rest wait and are counted (FR-021). */
export const MAX_VISIBLE_BANNERS = 3;

/**
 * Which notifications become banners now: unread, created after the app opened, not yet shown (FR-021,
 * FR-024). `since` is null until the first list arrives; that list only sets it — the newest it holds —
 * so opening the app replays nothing. It then stays fixed and `shown` keeps each banner single: a
 * notification committed a moment after a newer one is still caught.
 */
export function pickBanners(
  items: BannerItem[],
  since: string | null,
  shown: ReadonlySet<string>,
): { fresh: BannerItem[]; since: string } {
  if (since === null) return { fresh: [], since: items[0]?.createdAt ?? "" };
  return { fresh: items.filter((n) => !n.readAt && n.createdAt > since && !shown.has(n.id)), since };
}

/** The order a `new_order` banner is about, from its link `/objednavka/<id>`. */
export const orderIdOf = (n: BannerItem): string | null =>
  n.kind === "new_order" ? (/^\/objednavka\/([0-9a-f-]+)$/.exec(n.link)?.[1] ?? null) : null;
