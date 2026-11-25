import { buildCalendar, buildToolSchemas, PROMPT_VERSION, prepareOrder, TOOL_NAMES, type ToolName } from "@bakery/core";
import type { Bakery } from "./bakery.repo.ts";
import { remainingCapacity } from "./bakery.repo.ts";
import { createStaffRequest } from "./calls.repo.ts";
import type { Db } from "./client.ts";
import { confirmDraft, saveDraft } from "./orders.repo.ts";

/** The call a tool runs for: whose drafts it may confirm, and the phone number the order gets. */
export type CallToolContext = {
  callId: string;
  callerPhone: string;
  bakery: Bakery;
  model: string;
  /** receives the notifications a tool created, for delivery after the response (spec 002) */
  onNotifications?: (ids: string[]) => void;
};

/** What the model gets back. Refusals are results, not errors, so the agent can explain them. */
export type CallToolResult = Record<string, unknown> & { ok: boolean };

/**
 * Runs one tool call of the customer agent. Arguments are validated with the same schemas the model
 * was given, and every rule runs in the core (ADR-0003; contracts/agent-tools.md). The Live call
 * route and the agent evals both use this, so an eval exercises the path a caller does (research R24).
 */
export async function runCallTool(
  db: Db,
  ctx: CallToolContext,
  name: string,
  rawArgs: unknown,
  now = new Date(),
): Promise<CallToolResult> {
  if (!(TOOL_NAMES as readonly string[]).includes(name)) return { ok: false, reason: "unknown_tool" };
  const tool = name as ToolName;
  const { bakery } = ctx;
  const schemas = buildToolSchemas(bakery.catalogue, buildCalendar(now, bakery.schedule));
  const args = schemas[tool].safeParse(rawArgs);
  if (!args.success)
    return {
      ok: false,
      reason: "invalid_arguments",
      detail: args.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; "),
    };

  if (tool === "prepare_order") {
    const a = schemas.prepare_order.parse(args.data);
    const remaining = await remainingCapacity(db, bakery.catalogue, a.pickup_date);
    const prepared = prepareOrder(
      {
        items: a.items.map((i) => ({ productId: i.product_id, quantity: i.quantity })),
        pickupDate: a.pickup_date,
        customerName: a.customer_name,
        customerPhone: ctx.callerPhone,
      },
      {
        now,
        channel: "phone",
        catalogue: bakery.catalogue,
        schedule: bakery.schedule,
        staffOverride: false,
        remaining,
      },
    );
    if (!prepared.ok) return prepared;
    const draftId = await saveDraft(db, prepared, "phone", { callId: ctx.callId }, now);
    return {
      ok: true,
      draft_id: draftId,
      lines: prepared.lines.map((l) => ({
        name: l.name,
        quantity: l.quantity,
        unit_price_czk: l.unitPriceCzk,
        subtotal_czk: l.subtotalCzk,
      })),
      total_czk: prepared.totalCzk,
      pickup_date: prepared.pickupDate,
      pickup_weekday: prepared.pickupWeekdayName,
    };
  }

  if (tool === "confirm_order") {
    const a = schemas.confirm_order.parse(args.data);
    const r = await confirmDraft(
      db,
      a.draft_id,
      { callId: ctx.callId },
      { promptVersion: PROMPT_VERSION, model: ctx.model },
      now,
    );
    if (!r.ok) return r;
    ctx.onNotifications?.(r.notificationIds);
    return { ok: true, order_number: r.orderNumber };
  }

  const a = schemas.request_staff.parse(args.data);
  const request = await createStaffRequest(db, {
    kind: a.kind,
    origin: "agent",
    customerName: a.customer_name ?? null,
    customerPhone: ctx.callerPhone,
    note: a.note,
    callId: ctx.callId,
  });
  ctx.onNotifications?.(request.notificationIds);
  return { ok: true };
}
