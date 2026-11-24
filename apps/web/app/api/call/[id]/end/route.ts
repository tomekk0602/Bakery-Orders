import {
  addUsage,
  LIVE_MODEL,
  NO_USAGE,
  percentile,
  promisesCallback,
  shadowCostUsd,
  usageFromProvider,
} from "@bakery/core";
import { createStaffRequest, endCall, hasStaffRequest, orderNumbersForCall } from "@bakery/db";
import { startObservation } from "@langfuse/tracing";
import { z } from "zod";
import { activeCall } from "@/server/active-call";
import { db, fail, json } from "@/server/runtime";
import { callTraceId, inCallTrace } from "@/server/telemetry";

type Ctx = { params: Promise<{ id: string }> };

const Count = z.number().int().nonnegative().optional();
const Modalities = z
  .array(z.object({ modality: z.string().optional(), tokenCount: Count }))
  .max(10)
  .optional();
/** One usage report of the Live session as the browser received it (research R27). */
const Usage = z.object({
  promptTokenCount: Count,
  responseTokenCount: Count,
  thoughtsTokenCount: Count,
  toolUsePromptTokenCount: Count,
  promptTokensDetails: Modalities,
  responseTokensDetails: Modalities,
});

const Body = z.object({
  reason: z.enum(["hangup", "capped", "error"]),
  transcript: z.array(z.object({ role: z.enum(["customer", "agent"]), text: z.string().max(4000) })).max(400),
  first_audio_ms: z.array(z.number().int().nonnegative().max(120_000)).max(200).default([]),
  usage: z.array(Usage).max(1000).default([]),
});

/**
 * Ends a call: stores the transcript (FR-009), checks a promised callback (FR-008), sets the outcome,
 * and records latency, tokens and the shadow cost on the call and its trace (FR-032, ADR-0013).
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const active = await activeCall(req, id);
  if (!active) return fail("call_not_active", "Hovor už skončil.", 404);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid", "Neplatná data hovoru.", 400);
  const { reason, transcript, first_audio_ms, usage } = parsed.data;

  const promised = transcript.some((t) => t.role === "agent" && promisesCallback(t.text));
  if (promised && !(await hasStaffRequest(db(), id))) {
    await createStaffRequest(db(), {
      kind: "callback",
      origin: "promised_not_recorded",
      customerPhone: active.call.callerPhone,
      note: "Asistent slíbil zpětné zavolání, ale požadavek nezapsal.",
      callId: id,
    });
  }

  const orders = await orderNumbersForCall(db(), id);
  const outcome =
    orders.length > 0
      ? "order"
      : (await hasStaffRequest(db(), id))
        ? "request"
        : reason === "capped"
          ? "capped"
          : reason === "error"
            ? "error"
            : "abandoned";

  // Each report is counted once; whether Live reports per response or cumulatively is checked on the
  // first measured call (research R27).
  const tokens = usage.map(usageFromProvider).reduce(addUsage, NO_USAGE);
  const cost = shadowCostUsd(LIVE_MODEL, tokens);
  const traceId = await callTraceId(id);

  await endCall(db(), id, {
    outcome,
    transcript,
    firstAudioMs: first_audio_ms,
    firstAudioMsP50: percentile(first_audio_ms, 50),
    firstAudioMsMax: first_audio_ms.length ? Math.max(...first_audio_ms) : null,
    tokensIn: tokens.inputText + tokens.inputAudio,
    tokensOut: tokens.outputText + tokens.outputAudio,
    shadowCostUsd: cost,
    traceId,
  });

  await inCallTrace(id, async (parent) => {
    // The transcript is not put into the trace: it holds names that no mask can find (research R27).
    startObservation(
      "live.session",
      {
        model: LIVE_MODEL,
        output: { outcome, orderNumbers: orders, turns: transcript.length },
        usageDetails: { ...tokens },
        costDetails: { total: cost },
        metadata: {
          reason,
          usageReports: usage.length,
          // the raw series settle whether Live reports per response or cumulatively (research R27)
          promptTokensPerReport: usage.map((u) => u.promptTokenCount ?? 0),
          responseTokensPerReport: usage.map((u) => u.responseTokenCount ?? 0),
          firstAudioP50: percentile(first_audio_ms, 50),
          firstAudioP95: percentile(first_audio_ms, 95),
        },
        level: outcome === "error" ? "ERROR" : "DEFAULT",
      },
      { asType: "generation", parentSpanContext: parent },
    ).end();
  });

  return json({ outcome, order_numbers: orders });
}
