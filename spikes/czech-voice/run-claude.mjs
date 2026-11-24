// Text-only test of Czech understanding through the local `claude` CLI (subscription, no API key).
// The same instructions, tools and utterances as the voice runners; the voice itself is not tested.
// Usage: node run-claude.mjs [model id or alias, default claude-sonnet-5-5]
// A "gemini-…" model runs the same suite against the Gemini API with native function calling
// (free tier, ADR-0005): node --env-file=.env run-claude.mjs gemini-3.8-flash
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { GoogleGenAI } from "@google/genai";
import { INSTRUCTIONS, TOOLS, runTool, loadUtterances, score, TODAY } from "./common.mjs";

const MODEL = process.argv[2] ?? "claude-sonnet-5-5";
const IS_GEMINI = MODEL.startsWith("gemini");
const gemini = IS_GEMINI ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;
if (IS_GEMINI && !process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing in spikes/czech-voice/.env");
const MAX_STEPS = 4; // tool calls the agent may chain inside one customer turn
const CALL_TIMEOUT_MS = 90000;
const POOL = MODEL.startsWith("gemini") ? 1 : 4; // Gemini free tier: one at a time, paced

const SYSTEM = `${INSTRUCTIONS}

Nástroje (JSON Schema):
${JSON.stringify(TOOLS, null, 1)}

Pracuješ v textovém režimu po krocích. V každém kroku vrať JSON:
- "say": co teď řekneš zákazníkovi (prázdný řetězec, když nic),
- "tool": volání nástroje {"name", "args"} nebo null.
Výsledek nástroje dostaneš v dalším kroku. Když nevoláš nástroj, předáváš slovo zákazníkovi.`;

const SCHEMA = JSON.stringify({
  type: "object",
  properties: {
    say: { type: "string" },
    tool: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          properties: { name: { type: "string", enum: TOOLS.map((t) => t.name) }, args: { type: "object" } },
          required: ["name", "args"],
        },
      ],
    },
  },
  required: ["say", "tool"],
});

function claude(prompt) {
  return new Promise((resolve, reject) => {
    const p = spawn(
      "claude",
      [
        "-p",
        "--model",
        MODEL,
        "--tools",
        "",
        "--strict-mcp-config",
        "--disable-slash-commands",
        "--setting-sources",
        "",
        "--no-session-persistence",
        "--output-format",
        "json",
        "--system-prompt",
        SYSTEM,
        "--json-schema",
        SCHEMA,
        prompt,
      ],
      { cwd: new URL(".", import.meta.url).pathname, stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "",
      err = "";
    const timer = setTimeout(() => {
      p.kill();
      reject(new Error("claude timeout"));
    }, CALL_TIMEOUT_MS);
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => {
      clearTimeout(timer);
      try {
        const r = JSON.parse(out);
        if (r.is_error) return reject(new Error(r.result ?? "claude error"));
        resolve(r.structured_output ?? JSON.parse(r.result));
      } catch (e) {
        reject(new Error(`claude exit ${code}: ${err || out.slice(0, 300)}`));
      }
    });
  });
}

// One step with Gemini's native function calling, mapped to the same {say, tool} shape.
const GEMINI_TOOLS = [
  {
    functionDeclarations: TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      parametersJsonSchema: t.parameters,
    })),
  },
];
// Free tier is limited per model and minute (2026-11-24: 3.6 Flash 5/min, 3.5 Flash-Lite 15/min,
// read from the 429 responses), so calls are spaced to stay under GEMINI_RPM.
const GEMINI_RPM = Number(process.env.GEMINI_RPM ?? 5);
let nextSlot = 0;
async function geminiStep(prompt) {
  const wait = nextSlot - Date.now();
  nextSlot = Math.max(nextSlot, Date.now()) + Math.ceil(60000 / GEMINI_RPM);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  const r = await gemini.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { systemInstruction: INSTRUCTIONS, tools: GEMINI_TOOLS },
  });
  const call = r.functionCalls?.[0];
  return { say: r.text ?? "", tool: call ? { name: call.name, args: call.args ?? {} } : null };
}

// Runs the agent until it hands the word back to the customer. Returns the actions of this turn.
async function agentTurn(history) {
  const actions = [];
  for (let step = 0; step < MAX_STEPS; step++) {
    const t0 = performance.now();
    const prompt = `Rozhovor zatím:\n${history.join("\n")}\n\nTvůj další krok:`;
    const a = IS_GEMINI ? await geminiStep(prompt) : await claude(prompt);
    actions.push({ ...a, ms: Math.round(performance.now() - t0) });
    if (a.say) history.push(`ASISTENT: ${a.say}`);
    if (!a.tool) break;
    history.push(`ASISTENT volá ${a.tool.name}(${JSON.stringify(a.tool.args)})`);
    history.push(`VÝSLEDEK ${a.tool.name}: ${JSON.stringify(runTool(a.tool.name, a.tool.args))}`);
  }
  return actions;
}

const norm = (s) => s.toLowerCase();
function checkTurn(t, actions) {
  const calls = actions.filter((a) => a.tool).map((a) => a.tool);
  const said = norm(actions.map((a) => a.say).join(" "));
  const fails = [];
  if (t.mustCall && !calls.some((c) => c.name === t.mustCall)) fails.push(`no ${t.mustCall}`);
  for (const n of t.mustNotCall ?? []) if (calls.some((c) => c.name === n)) fails.push(`called ${n}`);
  if (t.mustNotCallDate && calls.some((c) => c.name === "prepare_order" && c.args.pickup_date === t.mustNotCallDate))
    fails.push(`order for closed day ${t.mustNotCallDate}`);
  if (t.order) {
    const prep = calls.filter((c) => c.name === "prepare_order").at(-1);
    const got = Object.fromEntries((prep?.args.items ?? []).map((i) => [i.product_id, i.quantity]));
    const ok =
      prep &&
      prep.args.pickup_date === t.order.date &&
      Object.keys(got).length === Object.keys(t.order.items).length &&
      Object.entries(t.order.items).every(([k, v]) => got[k] === v);
    if (!ok) fails.push(`order ${JSON.stringify(got)} ${prep?.args.pickup_date}`);
  }
  if (t.sayAny && !t.sayAny.some((w) => said.includes(norm(w)))) fails.push(`said none of ${t.sayAny.join("/")}`);
  if (
    t.callOrSay &&
    !calls.some((c) => c.name === t.callOrSay.call) &&
    !t.callOrSay.sayAny.some((w) => said.includes(w))
  )
    fails.push("no callback offered");
  return fails;
}

async function pool(items, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: POOL }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]).catch((e) => ({ error: String(e) }));
      }
    }),
  );
  return out;
}

// Part 1: the ten single utterances, scored exactly as in the voice runners.
const singles = await pool(loadUtterances(), async (u) => {
  const history = [`ZÁKAZNÍK: ${u.text}`];
  const actions = await agentTurn(history);
  const calls = actions.filter((a) => a.tool).map((a) => ({ name: a.tool.name, args: a.tool.args }));
  return {
    id: u.id,
    ...score(u, calls),
    ms: actions.reduce((s, a) => s + a.ms, 0),
    steps: actions.length,
    transcript: history,
  };
});

// Part 2: multi-turn dialogues.
const dialogs = JSON.parse(readFileSync(new URL("./dialogs.json", import.meta.url), "utf8"));
const multi = await pool(dialogs, async (d) => {
  const history = [];
  const turns = [];
  for (const t of d.turns) {
    history.push(`ZÁKAZNÍK: ${t.say}`);
    const actions = await agentTurn(history);
    turns.push({ say: t.say, fails: checkTurn(t, actions) });
  }
  const fails = turns.flatMap((t, i) => t.fails.map((f) => `turn ${i + 1}: ${f}`));
  return { id: d.id, covers: d.covers, pass: fails.length === 0, why: fails.join("; ") || "ok", transcript: history };
});

mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
writeFileSync(
  new URL(`./out/claude-${MODEL}.json`, import.meta.url),
  JSON.stringify({ model: MODEL, today: TODAY, singles, multi }, null, 2),
);

const line = (r) => `  ${r.error ? "ERR " : r.pass ? "PASS" : "FAIL"} ${r.id ?? ""} ${r.error ?? r.why}`;
console.log(`claude ${MODEL} — single utterances: ${singles.filter((r) => r.pass).length}/${singles.length}`);
singles.forEach((r) => console.log(line(r)));
console.log(`claude ${MODEL} — dialogues: ${multi.filter((r) => r.pass).length}/${multi.length}`);
multi.forEach((r) => console.log(line(r)));
