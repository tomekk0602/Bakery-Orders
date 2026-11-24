import { z } from "zod";

export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");
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
export const SetOrderStatusBody = z.object({ status: z.enum(["picked_up", "confirmed"]) });
export type SetOrderStatusBody = z.infer<typeof SetOrderStatusBody>;
