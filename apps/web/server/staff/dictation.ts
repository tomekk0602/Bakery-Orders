import "server-only";
import {
  buildCalendar,
  buildDictationSchema,
  buildInstructions,
  DICTATION_MODEL,
  dictationJsonSchema,
  missingFields,
  shadowCostUsd,
  usageFromProvider,
} from "@bakery/core";
import { DictationResponse } from "@bakery/core/contracts";
import { loadBakery } from "@bakery/db";
import { startObservation } from "@langfuse/tracing";
import { db } from "../runtime";
import { inTrace } from "../telemetry";
import { DictationUnavailable, extractOrder } from "./dictation-model";
import { prepareStaffOrder, REFUSAL_MESSAGES } from "./new-order";

/**
 * One staff sentence → recognised fields, unmatched words with candidates, missing fields, and an
 * order card when nothing is missing or unmatched (FR-018–FR-021). The model only fills a schema;
 * the card is prepared by the core like a form order.
 */
export function dictate(text: string, userId: string, now = new Date()): Promise<DictationResponse> {
  return inTrace("dictation", userId, () => dictateTraced(text, userId, now));
}

async function dictateTraced(text: string, userId: string, now: Date): Promise<DictationResponse> {
  const bakery = await loadBakery(db());
  const calendar = buildCalendar(now, bakery.schedule);
  const schema = buildDictationSchema(bakery.catalogue, calendar);
  const instructions = buildInstructions({
    mode: "staff",
    bakeryName: bakery.name,
    calendar,
    catalogue: bakery.catalogue,
  });

  // The sentence holds the customer's name, so the trace gets its length, never its text (research R27).
  const generation = startObservation(
    "dictation",
    { model: DICTATION_MODEL, input: { characters: text.length }, modelParameters: { temperature: 0 } },
    { asType: "generation" },
  );
  let extracted: Awaited<ReturnType<typeof extractOrder>>;
  try {
    extracted = await extractOrder({ text, instructions, jsonSchema: dictationJsonSchema(schema) });
  } catch (err) {
    generation.update({ level: "ERROR", statusMessage: DictationUnavailable.is(err) ? err.reason : "provider" }).end();
    throw err;
  }
  const tokens = usageFromProvider(extracted.usage);
  const parsed = schema.safeParse(extracted.value);
  generation
    .update({
      output: parsed.success ? parsed.data : { invalid: true },
      usageDetails: { ...tokens },
      costDetails: { total: shadowCostUsd(DICTATION_MODEL, tokens) },
      level: parsed.success ? "DEFAULT" : "ERROR",
    })
    .end();
  if (!parsed.success) throw new DictationUnavailable("invalid_output", parsed.error);
  const e = parsed.data;

  const nameOf = (id: string) => bakery.catalogue.find((p) => p.id === id)?.name ?? id;
  const unmatched = e.unmatched.map((u) => ({
    word: u.word,
    quantity: u.quantity,
    candidates: u.candidateIds.map((id) => ({ id, name: nameOf(id) })),
  }));
  const missing = missingFields(e);

  let card = null;
  let refusal = null;
  if (missing.length === 0 && unmatched.length === 0 && e.customerName && e.pickupDate) {
    const prepared = await prepareStaffOrder(
      { customerName: e.customerName, customerPhone: null, pickupDate: e.pickupDate, items: e.items },
      userId,
      now,
    );
    if (prepared.ok) card = prepared.card;
    else refusal = { code: prepared.reason, message: REFUSAL_MESSAGES[prepared.reason] };
  }

  return DictationResponse.parse({
    text,
    extraction: { customerName: e.customerName, pickupDate: e.pickupDate, items: e.items },
    unmatched,
    missing,
    card,
    refusal,
  });
}
