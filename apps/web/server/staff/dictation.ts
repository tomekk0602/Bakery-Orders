import "server-only";
import { buildCalendar, buildDictationSchema, buildInstructions, dictationJsonSchema, missingFields } from "@bakery/core";
import { DictationResponse } from "@bakery/core/contracts";
import { loadBakery } from "@bakery/db";
import { db } from "../runtime";
import { DictationUnavailable, extractOrder } from "./dictation-model";
import { prepareStaffOrder, REFUSAL_MESSAGES } from "./new-order";

/**
 * One staff sentence → recognised fields, unmatched words with candidates, missing fields, and an
 * order card when nothing is missing or unmatched (FR-018–FR-021). The model only fills a schema;
 * the card is prepared by the core like a form order.
 */
export async function dictate(text: string, userId: string, now = new Date()): Promise<DictationResponse> {
  const bakery = await loadBakery(db());
  const calendar = buildCalendar(now, bakery.schedule);
  const schema = buildDictationSchema(bakery.catalogue, calendar);
  const instructions = buildInstructions({ mode: "staff", bakeryName: bakery.name, calendar, catalogue: bakery.catalogue });

  const parsed = schema.safeParse(await extractOrder({ text, instructions, jsonSchema: dictationJsonSchema(schema) }));
  if (!parsed.success) throw new DictationUnavailable("invalid_output", parsed.error);
  const e = parsed.data;

  const nameOf = (id: string) => bakery.catalogue.find((p) => p.id === id)?.name ?? id;
  const unmatched = e.unmatched.map((u) => ({ word: u.word, quantity: u.quantity, candidates: u.candidateIds.map((id) => ({ id, name: nameOf(id) })) }));
  const missing = missingFields(e);

  let card = null;
  let refusal = null;
  if (missing.length === 0 && unmatched.length === 0 && e.customerName && e.pickupDate) {
    const prepared = await prepareStaffOrder({ customerName: e.customerName, customerPhone: null, pickupDate: e.pickupDate, items: e.items }, userId, now);
    if (prepared.ok) card = prepared.card;
    else refusal = { code: prepared.reason, message: REFUSAL_MESSAGES[prepared.reason] };
  }

  return DictationResponse.parse({ text, extraction: { customerName: e.customerName, pickupDate: e.pickupDate, items: e.items }, unmatched, missing, card, refusal });
}
