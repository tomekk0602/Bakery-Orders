import { z } from "zod";
import { IsoDate } from "./orders.ts";
import { PlanDay } from "./plan.ts";

/** A Czech or international phone number as staff type it; spaces are allowed and dropped. */
export const Phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ]{9,16}$/, "phone")
  .transform((v) => v.replace(/\s+/g, ""));

/** GET /api/staff/order-form — what the new-order form offers: active products and open days. */
export const OrderFormResponse = z.object({
  products: z.array(z.object({ id: z.string(), name: z.string(), priceCzk: z.number().int().nonnegative() })),
  days: z.array(PlanDay),
});
export type OrderFormResponse = z.infer<typeof OrderFormResponse>;

/** POST /api/staff/orders — an order typed by staff; the phone is optional for staff (FR-021). */
export const StaffOrderInput = z.object({
  customerName: z.string().trim().min(1, "name").max(80),
  customerPhone: Phone.nullable(),
  pickupDate: IsoDate,
  items: z
    .array(z.object({ productId: z.string(), quantity: z.number().int().min(1).max(200) }))
    .min(1, "items")
    .max(20),
});
/** What the form sends (before validation) and what the server works with (after). */
export type StaffOrderInput = z.input<typeof StaffOrderInput>;
export type StaffOrderData = z.output<typeof StaffOrderInput>;

/** The order card to confirm: lines and total computed by the core, nothing saved yet (FR-019). */
export const OrderCard = z.object({
  draftId: z.uuid(),
  customerName: z.string(),
  customerPhone: z.string().nullable(),
  pickupDate: IsoDate,
  pickupWeekdayName: z.string(),
  lines: z.array(z.object({ productId: z.string(), name: z.string(), quantity: z.number().int(), unitPriceCzk: z.number().int(), subtotalCzk: z.number().int() })),
  totalCzk: z.number().int().nonnegative(),
});
export type OrderCard = z.infer<typeof OrderCard>;

/** POST /api/staff/drafts/:id/confirm */
export const ConfirmDraftResponse = z.object({ orderId: z.uuid(), orderNumber: z.number().int() });
export type ConfirmDraftResponse = z.infer<typeof ConfirmDraftResponse>;
