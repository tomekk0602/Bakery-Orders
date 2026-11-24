import "server-only";
import { buildCalendar, prepareOrder, type RefusalReason } from "@bakery/core";
import { ConfirmDraftResponse, OrderCard, OrderFormResponse, type StaffOrderData } from "@bakery/core/contracts";
import { confirmDraft, loadBakery, remainingCapacity, saveDraft } from "@bakery/db";
import { REFUSAL_MESSAGES } from "../refusals";
import { db } from "../runtime";

export { REFUSAL_MESSAGES };


/** Active products and the open days of the ordering window, today included for staff. */
export async function orderForm(now = new Date()): Promise<OrderFormResponse> {
  const bakery = await loadBakery(db());
  const days = buildCalendar(now, bakery.schedule)
    .filter((d) => !d.closed)
    .map((d) => ({ date: d.date, weekdayName: d.weekdayName, relative: d.relative, closed: d.closed }));
  const products = bakery.catalogue.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, priceCzk: p.priceCzk }));
  return OrderFormResponse.parse({ products, days });
}

/** Prepares a staff order with the cut-off override and stores it as the staff member's draft (FR-013, FR-019). */
export async function prepareStaffOrder(input: StaffOrderData, userId: string, now = new Date()): Promise<{ ok: true; card: OrderCard } | { ok: false; reason: RefusalReason }> {
  const bakery = await loadBakery(db());
  const remaining = await remainingCapacity(db(), bakery.catalogue, input.pickupDate);
  const prepared = prepareOrder(
    { items: input.items, pickupDate: input.pickupDate, customerName: input.customerName, customerPhone: input.customerPhone },
    { now, channel: "staff", catalogue: bakery.catalogue, schedule: bakery.schedule, staffOverride: true, remaining },
  );
  if (!prepared.ok) return { ok: false, reason: prepared.reason };
  const draftId = await saveDraft(db(), prepared, "staff", { userId }, now);
  const { ok: _ok, ...card } = prepared;
  return { ok: true, card: OrderCard.parse({ ...card, draftId }) };
}

export async function confirmStaffDraft(draftId: string, userId: string) {
  const r = await confirmDraft(db(), draftId, { userId }, { promptVersion: null, model: null });
  return r.ok ? { ok: true as const, ...ConfirmDraftResponse.parse({ orderId: r.orderId, orderNumber: r.orderNumber }) } : r;
}
