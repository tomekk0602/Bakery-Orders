import { buildCalendar, describeDay, isAfterCutoff, pragueDate, type BakerySchedule } from "./calendar.ts";
import { activeProducts, type Product } from "./catalogue.ts";
import { orderTotal, priceLines, type OrderItem, type PricedLine } from "./pricing.ts";

export type OrderChannel = "phone" | "web" | "staff";

export type PrepareInput = {
  items: OrderItem[];
  pickupDate: string;
  customerName: string;
  customerPhone?: string | null;
};

export type PrepareContext = {
  now: Date;
  channel: OrderChannel;
  catalogue: readonly Product[];
  schedule: BakerySchedule;
  /** granted by the server from a staff session, never by the client (FR-013) */
  staffOverride: boolean;
  /** remaining pieces per product for the pickup day; absent = unlimited */
  remaining: Readonly<Record<string, number | null | undefined>>;
};

export const REFUSAL_REASONS = [
  "empty_order",
  "invalid_quantity",
  "unknown_product",
  "past_day",
  "outside_window",
  "closed_day",
  "after_cutoff",
  "over_limit",
  "missing_name",
  "missing_phone",
] as const;
export type RefusalReason = (typeof REFUSAL_REASONS)[number];

export type Refusal = { ok: false; reason: RefusalReason; detail?: string };

export type PreparedOrder = {
  ok: true;
  lines: PricedLine[];
  totalCzk: number;
  pickupDate: string;
  pickupWeekdayName: string;
  customerName: string;
  customerPhone: string | null;
};

const refuse = (reason: RefusalReason, detail?: string): Refusal =>
  detail ? { ok: false, reason, detail } : { ok: false, reason };

/** Every rule an order must pass before it can be read back and confirmed (ADR-0003). */
export function prepareOrder(input: PrepareInput, ctx: PrepareContext): PreparedOrder | Refusal {
  if (input.items.length === 0) return refuse("empty_order");
  if (input.items.some((i) => !Number.isInteger(i.quantity) || i.quantity < 1)) return refuse("invalid_quantity");

  const offered = activeProducts(ctx.catalogue);
  const unknown = input.items.find((i) => !offered.some((p) => p.id === i.productId));
  if (unknown) return refuse("unknown_product", unknown.productId);

  const merged = new Map<string, number>();
  for (const i of input.items) merged.set(i.productId, (merged.get(i.productId) ?? 0) + i.quantity);
  const items = [...merged].map(([productId, quantity]) => ({ productId, quantity }));

  const today = pragueDate(ctx.now);
  if (input.pickupDate < today) return refuse("past_day");
  const window = buildCalendar(ctx.now, ctx.schedule);
  if (!window.some((d) => d.date === input.pickupDate)) return refuse("outside_window");
  const day = describeDay(input.pickupDate, ctx.schedule);
  if (day.closed) return refuse("closed_day", day.closedReason ?? undefined);
  if (!ctx.staffOverride && isAfterCutoff(input.pickupDate, ctx.now, ctx.schedule)) return refuse("after_cutoff");

  for (const i of items) {
    const left = ctx.remaining[i.productId];
    if (left !== null && left !== undefined && i.quantity > left) return refuse("over_limit", `${i.productId}:${left}`);
  }

  const customerName = input.customerName.trim();
  if (!customerName) return refuse("missing_name");
  const customerPhone = input.customerPhone?.trim() || null;
  if (ctx.channel !== "staff" && !customerPhone) return refuse("missing_phone");

  const lines = priceLines(items, offered);
  return {
    ok: true,
    lines,
    totalCzk: orderTotal(lines),
    pickupDate: input.pickupDate,
    pickupWeekdayName: day.weekdayName,
    customerName,
    customerPhone,
  };
}
