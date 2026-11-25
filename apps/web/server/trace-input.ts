import "server-only";
import type { ToolSchemas } from "@bakery/core";

/**
 * The only argument keys a tool call's trace may carry (spec 001 FR-032 as clarified 2026-11-25,
 * research R35): products, quantities, the day, the draft and the request kind. Free text — a request's
 * note, a name — is left out rather than masked: a name inside free text cannot be found reliably.
 */
const TRACE_KEYS = new Set(["items", "product_id", "quantity", "pickup_date", "draft_id", "kind"]);

function keepAllowed(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(keepAllowed);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => TRACE_KEYS.has(k))
        .map(([k, v]) => [k, keepAllowed(v)]),
    );
  return value;
}

/**
 * What a tool call's span records as input: the validated arguments with allowlisted keys only.
 * Arguments that fail validation are not exported at all — the span says only that they were invalid.
 */
export function toolTraceInput(schemas: ToolSchemas, name: string, args: unknown): unknown {
  if (!Object.hasOwn(schemas, name)) return { valid: false, reason: "unknown_tool" };
  const parsed = schemas[name as keyof ToolSchemas].safeParse(args);
  return parsed.success ? keepAllowed(parsed.data) : { valid: false };
}
