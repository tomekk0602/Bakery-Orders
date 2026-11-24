import {
  buildCalendar,
  buildDictationSchema,
  buildInstructions,
  buildToolSchemas,
  CALL_OPENING,
  DICTATION_CONFIG,
  DICTATION_MODEL,
  type DictationExtraction,
  dictationJsonSchema,
  greeting,
  PROMPT_VERSION,
  toolDeclarations,
} from "@bakery/core";
import { callResult, createCall, runCallTool } from "@bakery/db";
import type { Content, Part } from "@google/genai";
import type { CustomerCase } from "./cases.ts";
import { EVAL_NOW, type EvalDb } from "./eval-db.ts";
import type { AgentTurn, CustomerRun } from "./graders.ts";
import { applyAblation, EVAL_AGENT_MODEL, generate } from "./model.ts";

/** Model steps allowed for one customer turn: a tool call, its result, the reply — and one retry. */
const MAX_STEPS_PER_TURN = 4;

/** The dates the agent may name: the same 14-day calendar its instructions carry. */
export const calendarDates = (env: EvalDb) => buildCalendar(EVAL_NOW, env.bakery.schedule).map((d) => d.date);

/**
 * One scripted conversation with the customer agent: its real instructions and tools, the tool calls
 * run by `runCallTool` against the eval database, exactly as in a call (research R24).
 */
export async function runConversation(c: CustomerCase, env: EvalDb): Promise<CustomerRun> {
  const { db, bakery } = env;
  const calendar = buildCalendar(EVAL_NOW, bakery.schedule);
  const systemInstruction = applyAblation(
    buildInstructions({ mode: "customer", bakeryName: bakery.name, calendar, catalogue: bakery.catalogue }),
  );
  const tools = [{ functionDeclarations: toolDeclarations(buildToolSchemas(bakery.catalogue, calendar), "customer") }];
  const callerPhone = "+420777000111";
  const callId = await createCall(db, {
    callerPhone,
    ipHash: "eval",
    promptVersion: PROMPT_VERSION,
    model: EVAL_AGENT_MODEL,
  });
  const ctx = { callId, callerPhone, bakery, model: EVAL_AGENT_MODEL };

  // The call opens like the call page opens it; the greeting is the one the instructions fix word for
  // word, written in rather than generated, which saves a request per conversation (research R24).
  const contents: Content[] = [
    { role: "user", parts: [{ text: CALL_OPENING }] },
    { role: "model", parts: [{ text: greeting(bakery.name) }] },
  ];
  const turns: AgentTurn[] = [];
  for (const t of c.turns) {
    contents.push({ role: "user", parts: [{ text: t.say }] });
    const turn: AgentTurn = { say: t.say, calls: [], reply: "" };
    for (let step = 0; step < MAX_STEPS_PER_TURN; step++) {
      const r = await generate({ model: EVAL_AGENT_MODEL, contents, config: { systemInstruction, tools } });
      const content = r.candidates?.[0]?.content;
      if (!content?.parts?.length) break;
      contents.push(content);
      turn.reply += content.parts.map((p) => p.text ?? "").join("");
      const calls = r.functionCalls ?? [];
      if (calls.length === 0) break;
      const responses: Part[] = [];
      for (const fc of calls) {
        const name = fc.name ?? "";
        const args = fc.args ?? {};
        const result = await runCallTool(db, ctx, name, args, EVAL_NOW);
        turn.calls.push({ name, args, result });
        responses.push({ functionResponse: { id: fc.id, name, response: result } });
      }
      contents.push({ role: "user", parts: responses });
    }
    turns.push(turn);
  }
  const outcome = await callResult(db, callId);
  return { turns, saved: outcome.saved, requests: outcome.requests };
}

/** One staff sentence through the dictation prompt and schema; output the schema rejects is a failure. */
export async function runDictation(text: string, env: EvalDb): Promise<DictationExtraction | { invalid: string }> {
  const { bakery } = env;
  const calendar = buildCalendar(EVAL_NOW, bakery.schedule);
  const schema = buildDictationSchema(bakery.catalogue, calendar);
  const instructions = applyAblation(
    buildInstructions({ mode: "staff", bakeryName: bakery.name, calendar, catalogue: bakery.catalogue }),
  );
  const r = await generate({
    model: DICTATION_MODEL,
    contents: text,
    config: { ...DICTATION_CONFIG, systemInstruction: instructions, responseJsonSchema: dictationJsonSchema(schema) },
  });
  let raw: unknown;
  try {
    raw = JSON.parse(r.text ?? "");
  } catch {
    return { invalid: "not JSON" };
  }
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : { invalid: parsed.error.issues[0]?.message ?? "schema" };
}
