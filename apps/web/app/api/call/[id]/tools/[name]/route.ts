import { buildToolSchemas, PROMPT_VERSION, prepareOrder, TOOL_NAMES, type ToolName } from "@bakery/core";
import { confirmDraft, createStaffRequest, remainingCapacity, saveDraft } from "@bakery/db";
import { activeCall } from "@/lib/active-call";
import { db, json, LIVE_MODEL } from "@/lib/server";

type Ctx = { params: Promise<{ id: string; name: string }> };

/**
 * Runs one tool call from the Live session. Arguments are validated with the same schemas the model
 * was given, and every rule runs in the core (ADR-0003; contracts/agent-tools.md).
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id, name } = await params;
  const active = await activeCall(req, id);
  if (!active) return json({ ok: false, reason: "call_not_active" }, 404);
  if (!(TOOL_NAMES as readonly string[]).includes(name)) return json({ ok: false, reason: "unknown_tool" }, 404);
  const tool = name as ToolName;
  const { call, bakery } = active;

  const schemas = buildToolSchemas(bakery.catalogue);
  const args = schemas[tool].safeParse(await req.json().catch(() => null));
  if (!args.success) return json({ ok: false, reason: "invalid_arguments", detail: args.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ") });

  if (tool === "prepare_order") {
    const a = schemas.prepare_order.parse(args.data);
    const remaining = await remainingCapacity(db(), bakery.catalogue, a.pickup_date);
    const prepared = prepareOrder(
      { items: a.items.map((i) => ({ productId: i.product_id, quantity: i.quantity })), pickupDate: a.pickup_date, customerName: a.customer_name, customerPhone: call.callerPhone },
      { now: new Date(), channel: "phone", catalogue: bakery.catalogue, schedule: bakery.schedule, staffOverride: false, remaining },
    );
    if (!prepared.ok) return json(prepared);
    const draftId = await saveDraft(db(), prepared, "phone", call.id);
    return json({
      ok: true,
      draft_id: draftId,
      lines: prepared.lines.map((l) => ({ name: l.name, quantity: l.quantity, unit_price_czk: l.unitPriceCzk, subtotal_czk: l.subtotalCzk })),
      total_czk: prepared.totalCzk,
      pickup_date: prepared.pickupDate,
      pickup_weekday: prepared.pickupWeekdayName,
    });
  }

  if (tool === "confirm_order") {
    const a = schemas.confirm_order.parse(args.data);
    const r = await confirmDraft(db(), a.draft_id, call.id, { callId: call.id, promptVersion: PROMPT_VERSION, model: LIVE_MODEL });
    return json(r.ok ? { ok: true, order_number: r.orderNumber } : r);
  }

  const a = schemas.request_staff.parse(args.data);
  await createStaffRequest(db(), { kind: a.kind, origin: "agent", customerName: a.customer_name ?? null, customerPhone: call.callerPhone, note: a.note, callId: call.id });
  return json({ ok: true });
}
