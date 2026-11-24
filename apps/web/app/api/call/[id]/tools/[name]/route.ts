import { runCallTool } from "@bakery/db";
import { startObservation } from "@langfuse/tracing";
import { activeCall } from "@/server/active-call";
import { db, json, LIVE_MODEL } from "@/server/runtime";
import { inCallTrace } from "@/server/telemetry";

type Ctx = { params: Promise<{ id: string; name: string }> };

/** Runs one tool call from the Live session; the rules are in `runCallTool` (contracts/agent-tools.md). */
export async function POST(req: Request, { params }: Ctx) {
  const { id, name } = await params;
  const active = await activeCall(req, id);
  if (!active) return json({ ok: false, reason: "call_not_active" }, 404);
  const { call, bakery } = active;
  const args: unknown = await req.json().catch(() => null);
  return inCallTrace(call.id, async (parent) => {
    const span = startObservation(`tool.${name}`, { input: args }, { asType: "tool", parentSpanContext: parent });
    const result = await runCallTool(
      db(),
      { callId: call.id, callerPhone: call.callerPhone, bakery, model: LIVE_MODEL },
      name,
      args,
    );
    // a refusal is the agent's to explain, not an error; it is marked so it can be counted
    span.update({ output: result, level: result.ok ? "DEFAULT" : "WARNING" }).end();
    return json(result, result.reason === "unknown_tool" ? 404 : 200);
  });
}
