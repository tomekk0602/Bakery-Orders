import { promisesCallback } from "@bakery/core";
import { createStaffRequest, endCall, hasStaffRequest, orderNumbersForCall } from "@bakery/db";
import { z } from "zod";
import { activeCall } from "@/lib/active-call";
import { db, fail, json } from "@/lib/server";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  reason: z.enum(["hangup", "capped", "error"]),
  transcript: z.array(z.object({ role: z.enum(["customer", "agent"]), text: z.string().max(4000) })).max(400),
  first_audio_ms: z.array(z.number().int().nonnegative().max(120_000)).max(200).default([]),
});

const median = (xs: number[]) => {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? null;
};

/** Ends a call: stores the transcript (FR-009), checks a promised callback (FR-008), sets the outcome. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const active = await activeCall(req, id);
  if (!active) return fail("call_not_active", "Hovor už skončil.", 404);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("invalid", "Neplatná data hovoru.", 400);
  const { reason, transcript, first_audio_ms } = parsed.data;

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
  const outcome = orders.length > 0 ? "order" : (await hasStaffRequest(db(), id)) ? "request" : reason === "capped" ? "capped" : reason === "error" ? "error" : "abandoned";
  await endCall(db(), id, { outcome, transcript, firstAudioMsP50: median(first_audio_ms), firstAudioMsMax: first_audio_ms.length ? Math.max(...first_audio_ms) : null });
  return json({ outcome, order_numbers: orders });
}
