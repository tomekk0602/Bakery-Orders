import { z } from "zod";

/** A real calendar day as YYYY-MM-DD: "2026-02-30" is refused, not passed on (spec 001 FR-063). */
export const IsoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD")
  .refine((s) => {
    const [y, m, d] = s.split("-").map(Number) as [number, number, number];
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  }, "date");
export const OrderSource = z.enum(["phone", "web", "staff"]);
export type OrderSource = z.infer<typeof OrderSource>;
export const OrderStatus = z.enum(["confirmed", "picked_up", "cancelled"]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const StaffOrderLine = z.object({
  productId: z.string(),
  name: z.string(),
  quantity: z.number().int().positive(),
  unitPriceCzk: z.number().int().nonnegative(),
});

export const StaffOrder = z.object({
  id: z.uuid(),
  number: z.number().int(),
  source: OrderSource,
  status: OrderStatus,
  customerName: z.string(),
  customerPhone: z.string().nullable(),
  pickupDay: IsoDate,
  totalCzk: z.number().int().nonnegative(),
  lines: z.array(StaffOrderLine),
  createdAt: z.iso.datetime(),
});
export type StaffOrder = z.infer<typeof StaffOrder>;

/** GET /api/staff/orders?day= — the orders to hand over on a day (today in Prague by default). */
export const StaffOrdersResponse = z.object({ day: IsoDate, orders: z.array(StaffOrder) });
export type StaffOrdersResponse = z.infer<typeof StaffOrdersResponse>;

export const TranscriptTurn = z.object({ role: z.enum(["customer", "agent"]), text: z.string() });
export type TranscriptTurn = z.infer<typeof TranscriptTurn>;

/** GET /api/staff/orders/:id — one order; phone orders carry the call transcript (FR-009, FR-012). */
export const StaffOrderDetail = StaffOrder.extend({ transcript: z.array(TranscriptTurn).nullable() });
export type StaffOrderDetail = z.infer<typeof StaffOrderDetail>;

/** PATCH /api/staff/orders/:id — hand an order over, or undo a mistaken hand-over. */
/** Hand over, undo a hand-over, or cancel — cancelling releases the reserved quantities (FR-012, FR-013). */
export const SetOrderStatusBody = z.object({ status: z.enum(["picked_up", "confirmed", "cancelled"]) });
export type SetOrderStatusBody = z.infer<typeof SetOrderStatusBody>;
