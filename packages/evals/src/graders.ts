import type { DictationExtraction } from "@bakery/core";
import type { CustomerCase, CustomerTurn, StaffCase } from "./cases.ts";

export type ToolCall = { name: string; args: Record<string, unknown>; result: Record<string, unknown> };
export type AgentTurn = { say: string; calls: ToolCall[]; reply: string };
export type SavedOrder = { items: Record<string, number>; date: string; name: string };
/** What one customer conversation produced: the turns, and what the database holds afterwards. */
export type CustomerRun = { turns: AgentTurn[]; saved: SavedOrder[]; requests: string[] };

export type Grade = { pass: boolean; why: string };
const ok: Grade = { pass: true, why: "ok" };
const fail = (why: string): Grade => ({ pass: false, why });

/** Names are compared by their first letters, so "Nováková" and "paní Novákové" match. */
const sameName = (got: unknown, want: string) =>
  typeof got === "string" && got.toLowerCase().includes(want.toLowerCase().slice(0, 5));

function sameItems(got: Record<string, number>, want: Record<string, number>): boolean {
  const keys = Object.keys(got);
  return keys.length === Object.keys(want).length && keys.every((k) => got[k] === want[k]);
}

const itemsOf = (args: Record<string, unknown>): Record<string, number> =>
  Object.fromEntries(
    ((args.items as { product_id: string; quantity: number }[] | undefined) ?? []).map((i) => [
      i.product_id,
      i.quantity,
    ]),
  );

const says = (reply: string, any: string[]) => any.some((s) => reply.toLowerCase().includes(s.toLowerCase()));

function gradeTurn(t: CustomerTurn, got: AgentTurn, i: number): Grade {
  const names = got.calls.map((c) => c.name);
  const at = `turn ${i + 1}`;
  if (t.mustCall && !names.includes(t.mustCall)) return fail(`${at}: no ${t.mustCall}`);
  const forbidden = (t.mustNotCall ?? []).find((n) => names.includes(n));
  if (forbidden) return fail(`${at}: called ${forbidden}`);
  if (
    t.mustNotCallDate &&
    got.calls.some((c) => c.name === "prepare_order" && c.args.pickup_date === t.mustNotCallDate)
  )
    return fail(`${at}: prepared for ${t.mustNotCallDate}`);
  if (t.order) {
    const prep = got.calls.filter((c) => c.name === "prepare_order").at(-1);
    if (!prep) return fail(`${at}: no prepare_order`);
    const items = itemsOf(prep.args);
    if (!sameItems(items, t.order.items)) return fail(`${at}: items ${JSON.stringify(items)}`);
    if (prep.args.pickup_date !== t.order.date) return fail(`${at}: date ${String(prep.args.pickup_date)}`);
    if (t.order.name && !sameName(prep.args.customer_name, t.order.name))
      return fail(`${at}: name ${String(prep.args.customer_name)}`);
  }
  if (t.sayAny && !says(got.reply, t.sayAny)) return fail(`${at}: reply lacks any of ${t.sayAny.join("/")}`);
  if (t.callOrSay && !names.includes(t.callOrSay.call) && !says(got.reply, t.callOrSay.sayAny))
    return fail(`${at}: neither ${t.callOrSay.call} nor an offer of a callback`);
  return ok;
}

/** Each turn's expectations: which tools, which order, what the reply must mention. */
export function gradeTurns(c: CustomerCase, run: CustomerRun): Grade {
  if (run.turns.length !== c.turns.length) return fail(`ran ${run.turns.length} of ${c.turns.length} turns`);
  for (const [i, t] of c.turns.entries()) {
    const g = gradeTurn(t, run.turns[i] as AgentTurn, i);
    if (!g.pass) return g;
  }
  return ok;
}

/** Nothing is saved without the customer's explicit yes (constitution II, FR-005). */
export function gradeConsent(c: CustomerCase, run: CustomerRun): Grade {
  const i = run.turns.findIndex(
    (t, n) => t.calls.some((call) => call.name === "confirm_order") && !c.turns[n]?.consent,
  );
  return i === -1 ? ok : fail(`confirm_order in turn ${i + 1} without a yes`);
}

/** Every prepared order names catalogue products and a day from the calendar (ADR-0010). */
export function gradeCatalogueAndCalendar(run: CustomerRun, calendarDates: readonly string[]): Grade {
  for (const call of run.turns.flatMap((t) => t.calls)) {
    if (call.result.reason === "invalid_arguments") return fail(`${call.name}: ${String(call.result.detail)}`);
    if (call.name === "prepare_order" && !calendarDates.includes(String(call.args.pickup_date)))
      return fail(`date ${String(call.args.pickup_date)} is not in the calendar`);
  }
  return ok;
}

/** What is in the database at the end: the expected order saved exactly once, the expected request recorded. */
export function gradeOutcome(c: CustomerCase, run: CustomerRun): Grade {
  const want = c.final?.saved;
  if (want) {
    if (run.saved.length !== 1) return fail(`${run.saved.length} orders saved`);
    const got = run.saved[0] as SavedOrder;
    if (!sameItems(got.items, want.items) || got.date !== want.date || !sameName(got.name, want.name))
      return fail(`saved ${JSON.stringify(got)}`);
  } else if (run.saved.length > 0) return fail(`${run.saved.length} orders saved, none expected`);
  if (c.final?.request && !run.requests.includes(c.final.request)) return fail(`no ${c.final.request} request`);
  return ok;
}

/** The staff sentence → the fields; an unknown word goes to `unmatched`, never into the order (FR-020). */
export function gradeDictation(c: StaffCase, got: DictationExtraction): Grade {
  const e = c.expect;
  const items = Object.fromEntries(got.items.map((i) => [i.productId, i.quantity]));
  if (!sameItems(items, e.items)) return fail(`items ${JSON.stringify(items)}`);
  if (got.pickupDate !== e.date) return fail(`date ${String(got.pickupDate)}`);
  if (e.name === null ? got.customerName !== null : !sameName(got.customerName, e.name))
    return fail(`name ${String(got.customerName)}`);
  if (got.unmatched.length !== e.unmatched.length)
    return fail(`unmatched ${JSON.stringify(got.unmatched.map((u) => u.word))}`);
  const missing = e.unmatched.find((w) => !got.unmatched.some((u) => u.word.toLowerCase().includes(w)));
  return missing ? fail(`"${missing}" not in unmatched`) : ok;
}
