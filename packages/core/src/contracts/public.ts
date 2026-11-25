import { z } from "zod";
import { Phone } from "./new-order.ts";
import { IsoDate } from "./orders.ts";
import { PlanDay } from "./plan.ts";

/** GET /api/catalogue — what a customer can order, and only the days still open for orders (FR-014). */
export const CatalogueResponse = z.object({
  bakeryName: z.string(),
  cutoffDaysBefore: z.number().int(),
  cutoffTime: z.string(),
  products: z.array(z.object({ id: z.string(), name: z.string(), priceCzk: z.number().int().positive() })),
  days: z.array(PlanDay),
});
export type CatalogueResponse = z.infer<typeof CatalogueResponse>;

/** POST /api/orders/preview and /api/orders — the phone is required for customers (FR-021). */
export const WebOrderInput = z.object({
  customerName: z.string().trim().min(1, "name").max(80),
  customerPhone: Phone,
  pickupDate: IsoDate,
  items: z
    .array(z.object({ productId: z.string(), quantity: z.number().int().min(1).max(200) }))
    .min(1, "items")
    .max(20),
});
export type WebOrderInput = z.input<typeof WebOrderInput>;
export type WebOrderData = z.output<typeof WebOrderInput>;

const Line = z.object({
  productId: z.string(),
  name: z.string(),
  quantity: z.number().int(),
  unitPriceCzk: z.number().int(),
  subtotalCzk: z.number().int(),
});

/** The summary the customer confirms, priced by the server; nothing saved yet. */
export const WebOrderPreview = z.object({
  customerName: z.string(),
  customerPhone: z.string(),
  pickupDate: IsoDate,
  pickupWeekdayName: z.string(),
  lines: z.array(Line),
  totalCzk: z.number().int(),
});
export type WebOrderPreview = z.infer<typeof WebOrderPreview>;

/**
 * POST /api/orders/preview — the summary plus the prepared order to confirm: its draft and a token
 * shown once; only whoever holds the token can confirm it (FR-064, research R36).
 */
export const WebOrderReview = WebOrderPreview.extend({ draftId: z.uuid(), token: z.string() });
export type WebOrderReview = z.infer<typeof WebOrderReview>;

/** POST /api/orders — confirms exactly the reviewed order; the same body again gives the same number (FR-065). */
export const WebOrderConfirm = z.object({ draftId: z.uuid(), token: z.string().min(20).max(100) });
export type WebOrderConfirm = z.infer<typeof WebOrderConfirm>;

/** The saved order: its number is what the customer refers to at the counter (FR-040). */
export const WebOrderPlaced = WebOrderPreview.extend({ orderNumber: z.number().int() });
export type WebOrderPlaced = z.infer<typeof WebOrderPlaced>;
