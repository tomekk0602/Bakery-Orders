import { runCallTool } from "@bakery/db";
import { activeCall } from "@/server/active-call";
import { db, json, LIVE_MODEL } from "@/server/runtime";

type Ctx = { params: Promise<{ id: string; name: string }> };

/** Runs one tool call from the Live session; the rules are in `runCallTool` (contracts/agent-tools.md). */
export async function POST(req: Request, { params }: Ctx) {
  const { id, name } = await params;
  const active = await activeCall(req, id);
  if (!active) return json({ ok: false, reason: "call_not_active" }, 404);
  const { call, bakery } = active;
  const result = await runCallTool(
    db(),
    { callId: call.id, callerPhone: call.callerPhone, bakery, model: LIVE_MODEL },
    name,
    await req.json().catch(() => null),
  );
  return json(result, result.reason === "unknown_tool" ? 404 : 200);
}
