// ElevenLabs Agents (ASR + LLM + TTS cascade) on the same scripted Czech utterances.
// Usage: node --env-file=.env run-elevenlabs.mjs [clean|phone]
// Creates one private agent on first run and reuses it (id cached in out/elevenlabs-agent.json).
import WebSocket from "ws";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { INSTRUCTIONS, TOOLS, runTool, loadUtterances, score, saveResults, pcm16ToWav } from "./common.mjs";

const VARIANT = process.argv[2] ?? "clean";
const RATE = 16000;
const CHUNK_MS = 100;
const TRAILING_SILENCE_MS = 1500;
const QUIET_END_MS = 4000;
const TURN_TIMEOUT_MS = 30000;
const KEY = process.env.ELEVENLABS_API_KEY;
if (!KEY) throw new Error("ELEVENLABS_API_KEY missing in spikes/czech-voice/.env");
const API = "https://api.elevenlabs.io/v1/convai";
const GREETING =
  "Dobrý den, Pekárna U Lípy, tady automatický asistent. Rád vám zarezervuju pečivo, nebo vám může zavolat kolega. Co si přejete?";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(new URL("./out/audio/", import.meta.url), { recursive: true });

async function agentId() {
  const cache = new URL("./out/elevenlabs-agent.json", import.meta.url);
  if (existsSync(cache)) return JSON.parse(readFileSync(cache, "utf8")).agent_id;
  const res = await fetch(`${API}/agents/create`, {
    method: "POST",
    headers: { "xi-api-key": KEY, "content-type": "application/json" },
    body: JSON.stringify({
      name: "bakery-voice-spike",
      conversation_config: {
        agent: {
          first_message: GREETING,
          language: "cs",
          prompt: {
            prompt: INSTRUCTIONS,
            llm: process.env.ELEVENLABS_LLM ?? "claude-haiku-4-5",
            tools: TOOLS.map((t) => ({ type: "client", expects_response: true, ...t })),
          },
        },
        asr: { user_input_audio_format: "pcm_16000" },
        tts: {
          model_id: process.env.ELEVENLABS_TTS_MODEL ?? "eleven_flash_v2_5",
          agent_output_audio_format: "pcm_16000",
        },
      },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`create agent ${res.status}: ${JSON.stringify(body)}`);
  writeFileSync(cache, JSON.stringify(body));
  return body.agent_id;
}

async function runOne(id, u) {
  const signed = await fetch(`${API}/conversation/get-signed-url?agent_id=${id}`, {
    headers: { "xi-api-key": KEY },
  }).then((r) => r.json());
  const ws = new WebSocket(signed.signed_url);
  const send = (o) => ws.send(JSON.stringify(o));
  const calls = [];
  const audio = [];
  let reply = "";
  let heard = "";
  let greeted = false;
  let lastEvent = performance.now();
  let speechEnd = null;
  let firstAudio = null;

  ws.on("message", (raw) => {
    const ev = JSON.parse(raw.toString());
    lastEvent = performance.now();
    switch (ev.type) {
      case "ping":
        send({ type: "pong", event_id: ev.ping_event?.event_id });
        break;
      case "audio":
        if (speechEnd) {
          if (firstAudio == null) firstAudio = performance.now();
          audio.push(Buffer.from(ev.audio_event.audio_base_64, "base64"));
        }
        break;
      case "agent_response":
        if (!speechEnd) greeted = true;
        else reply += ev.agent_response_event.agent_response + " ";
        break;
      case "user_transcript":
        heard = ev.user_transcription_event?.user_transcript ?? heard;
        break;
      case "client_tool_call": {
        const c = ev.client_tool_call;
        calls.push({ name: c.tool_name, args: c.parameters });
        send({
          type: "client_tool_result",
          tool_call_id: c.tool_call_id,
          result: JSON.stringify(runTool(c.tool_name, c.parameters)),
          is_error: false,
        });
        break;
      }
    }
  });
  await new Promise((r, j) => {
    ws.once("open", r);
    ws.once("error", j);
  });
  send({ type: "conversation_initiation_client_data" });

  // Let the greeting play out before the caller speaks.
  const t0 = performance.now();
  while (!(greeted && performance.now() - lastEvent > 1000) && performance.now() - t0 < 15000) await sleep(100);

  const pcm = readFileSync(new URL(`./audio/${u.id}.${VARIANT}.${RATE}.pcm`, import.meta.url));
  const step = (RATE * 2 * CHUNK_MS) / 1000;
  for (let i = 0; i < pcm.length; i += step) {
    send({ user_audio_chunk: pcm.subarray(i, i + step).toString("base64") });
    await sleep(CHUNK_MS);
  }
  speechEnd = performance.now();
  const silence = Buffer.alloc(step).toString("base64");
  // Keep the line "open" with silence, as a phone would, until the agent finishes.
  let outcome = "timeout";
  while (performance.now() - speechEnd < TURN_TIMEOUT_MS) {
    send({ user_audio_chunk: silence });
    await sleep(CHUNK_MS);
    if (performance.now() - speechEnd < TRAILING_SILENCE_MS) continue;
    if (firstAudio && performance.now() - lastEvent > QUIET_END_MS) {
      outcome = "done";
      break;
    }
  }
  ws.close();
  writeFileSync(
    new URL(`./out/audio/elevenlabs-${VARIANT}-${u.id}.wav`, import.meta.url),
    pcm16ToWav(Buffer.concat(audio), RATE),
  );
  const s = score(u, calls);
  return {
    id: u.id,
    outcome,
    latencyMs: firstAudio ? Math.round(firstAudio - speechEnd) : null,
    heard,
    reply: reply.trim(),
    calls,
    ...s,
  };
}

const id = await agentId();
const rows = [];
for (const u of loadUtterances()) {
  const r = await runOne(id, u);
  console.log(`${r.pass ? "PASS" : "FAIL"} ${u.id} ${r.latencyMs} ms | heard: ${r.heard} | reply: ${r.reply}`);
  rows.push(r);
}
saveResults("elevenlabs", VARIANT, rows);
