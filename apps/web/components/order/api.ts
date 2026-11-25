import {
  ApiError,
  CatalogueResponse,
  type WebOrderConfirm,
  WebOrderPlaced,
  WebOrderReview,
  type WebOrderInput,
} from "@bakery/core/contracts";
import type { z } from "zod";

/** A failure with the server's Czech message, shown as it is. */
export class OrderError extends Error {
  constructor(
    message: string,
    readonly uncertain = false,
  ) {
    super(message);
  }
}

async function call<S extends z.ZodType>(path: string, schema: S, init?: RequestInit): Promise<z.infer<S>> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json" } }).catch(() => null);
  if (!res) throw new OrderError("Server neodpovídá. Zkuste to prosím znovu.", true);
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = ApiError.safeParse(body);
    throw new OrderError(err.success ? err.data.error.message : "Objednávku se nepodařilo odeslat.", res.status >= 500);
  }
  return schema.parse(body);
}

export const loadCatalogue = () => call("/api/catalogue", CatalogueResponse);
export const previewOrder = (o: WebOrderInput) =>
  call("/api/orders/preview", WebOrderReview, { method: "POST", body: JSON.stringify(o) });
/** Confirms the reviewed order; sending the same confirmation again is safe — it returns the same number (FR-065). */
export const placeOrder = (c: WebOrderConfirm) =>
  call("/api/orders", WebOrderPlaced, { method: "POST", body: JSON.stringify(c) });
