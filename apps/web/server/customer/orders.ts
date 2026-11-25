import "server-only";
import { buildCalendar, isAfterCutoff, prepareOrder, type PreparedOrder, type RefusalReason } from "@bakery/core";
import { CatalogueResponse, WebOrderPlaced, WebOrderPreview, type WebOrderData } from "@bakery/core/contracts";
import { loadBakery, placeWebOrder, remainingCapacity } from "@bakery/db";
import { scheduleDelivery } from "../notifications/deliver";
import { db } from "../runtime";

/** Per-IP limits for the public form; proposed values, not measured (ADR-0014). */
export const WEB_ORDER_LIMIT = { max: 10, windowMs: 60 * 60 * 1000 };
export const WEB_PREVIEW_LIMIT = { max: 60, windowMs: 60 * 60 * 1000 };

/** Products and the days a customer can still order for: open and before the cut-off (FR-014). */
export async function catalogue(now = new Date()): Promise<CatalogueResponse> {
  const bakery = await loadBakery(db());
  const days = buildCalendar(now, bakery.schedule)
    .filter((d) => !d.closed && !isAfterCutoff(d.date, now, bakery.schedule))
    .map((d) => ({ date: d.date, weekdayName: d.weekdayName, relative: d.relative, closed: d.closed }));
  return CatalogueResponse.parse({
    bakeryName: bakery.name,
    cutoffDaysBefore: bakery.schedule.cutoffDaysBefore,
    cutoffTime: bakery.schedule.cutoffTime,
    products: bakery.catalogue.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, priceCzk: p.priceCzk })),
    days,
  });
}

type Prepared = { ok: true; order: PreparedOrder } | { ok: false; reason: RefusalReason };

/** The same rules as the agent: cut-off, closed days, limits, phone required (FR-007, FR-014). */
async function prepare(input: WebOrderData, now: Date): Promise<Prepared> {
  const bakery = await loadBakery(db());
  const remaining = await remainingCapacity(db(), bakery.catalogue, input.pickupDate);
  const r = prepareOrder(input, {
    now,
    channel: "web",
    catalogue: bakery.catalogue,
    schedule: bakery.schedule,
    staffOverride: false,
    remaining,
  });
  return r.ok ? { ok: true, order: r } : { ok: false, reason: r.reason };
}

const summary = (o: PreparedOrder) => ({
  customerName: o.customerName,
  customerPhone: o.customerPhone ?? "",
  pickupDate: o.pickupDate,
  pickupWeekdayName: o.pickupWeekdayName,
  lines: o.lines,
  totalCzk: o.totalCzk,
});

export async function previewWebOrder(input: WebOrderData, now = new Date()) {
  const r = await prepare(input, now);
  return r.ok ? { ok: true as const, preview: WebOrderPreview.parse(summary(r.order)) } : r;
}

export async function placeOrder(input: WebOrderData, now = new Date()) {
  const r = await prepare(input, now);
  if (!r.ok) return r;
  const saved = await placeWebOrder(db(), r.order);
  if (saved.ok) scheduleDelivery(saved.notificationIds); // spec 002 FR-017
  return saved.ok
    ? { ok: true as const, placed: WebOrderPlaced.parse({ ...summary(r.order), orderNumber: saved.orderNumber }) }
    : { ok: false as const, reason: saved.reason };
}
