// OpenAI Realtime (speech to speech) on the scripted Czech utterances.
// Usage: node --env-file=.env run-openai.mjs [clean|phone]
import WebSocket from "ws";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { INSTRUCTIONS, TOOLS, runTool, loadUtterances, score, saveResults, pcm16ToWav } from "./common.mjs";

const MODEL = process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime-2.1";
const VARIANT = process.argv[2] ?? "clean";
const RATE = 24000;
const CHUNK_MS = 100;
const TRAILING_SILENCE_MS = 1500;
const TURN_TIMEOUT_MS = 30000;
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing in spikes/czech-voice/.env");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runOne(u) {
  const ws = new WebSocket(`wss://api.openai.com/v1/realtime?model=${MODEL}`, {
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
  });
  const send = (o) => ws.send(JSON.stringify(o));
  const calls = [];
  const audio = [];
  let transcript = "";
  let heard = "";
  let speechEnd = null;
  let firstAudio = null;
  let responses = 0;

  const finished = new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve("timeout"), TURN_TIMEOUT_MS);
    ws.on("error", reject);
    ws.on("message", (raw) => {
      const ev = JSON.parse(raw.toString());
      switch (ev.type) {
        case "error":
          console.error(`  [${u.id}] error`, ev.error?.message ?? ev);
          break;
        case "response.output_audio.delta":
        case "response.audio.delta":
          if (speechEnd && firstAudio == null) firstAudio = performance.now();
          audio.push(Buffer.from(ev.delta, "base64"));
          break;
        case "response.output_audio_transcript.delta":
        case "response.audio_transcript.delta":
          transcript += ev.delta;
          break;
        case "conversation.item.input_audio_transcription.completed":
          heard = ev.transcript;
          break;
        case "response.function_call_arguments.done": {
          let args = {};
          try { args = JSON.parse(ev.arguments || "{}"); } catch { args = { _raw: ev.arguments }; }
          calls.push({ name: ev.name, args });
          send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: ev.call_id, output: JSON.stringify(runTool(ev.name, args)) } });
          break;
        }
        case "response.done": {
          responses++;
          const hadCall = ev.response?.output?.some((o) => o.type === "function_call");
          if (hadCall && responses < 5) send({ type: "response.create" });
          else { clearTimeout(timer); resolve("done"); }
          break;
        }
      }
    });
  });

  await new Promise((r, j) => { ws.once("open", r); ws.once("error", j); });
  send({
    type: "session.update",
    session: {
      type: "realtime",
      instructions: INSTRUCTIONS,
      output_modalities: ["audio"],
      audio: {
        input: {
          format: { type: "audio/pcm", rate: RATE },
          turn_detection: { type: "server_vad", silence_duration_ms: 500 },
          transcription: { model: "whisper-1", language: "cs" },
        },
        output: { format: { type: "audio/pcm", rate: RATE }, voice: process.env.OPENAI_VOICE ?? "marin" },
      },
      tools: TOOLS.map((t) => ({ type: "function", ...t })),
      tool_choice: "auto",
    },
  });
  await sleep(300);

  // Real-time pacing, so "end of speech" is when a caller would stop talking.
  const pcm = readFileSync(new URL(`./audio/${u.id}.${VARIANT}.${RATE}.pcm`, import.meta.url));
  const step = (RATE * 2 * CHUNK_MS) / 1000;
  for (let i = 0; i < pcm.length; i += step) {
    send({ type: "input_audio_buffer.append", audio: pcm.subarray(i, i + step).toString("base64") });
    await sleep(CHUNK_MS);
  }
  speechEnd = performance.now();
  const silence = Buffer.alloc(step);
  for (let t = 0; t < TRAILING_SILENCE_MS; t += CHUNK_MS) {
    send({ type: "input_audio_buffer.append", audio: silence.toString("base64") });
    await sleep(CHUNK_MS);
  }

  const outcome = await finished;
  ws.close();
  mkdirSync(new URL("./out/audio/", import.meta.url), { recursive: true });
  writeFileSync(new URL(`./out/audio/openai-${VARIANT}-${u.id}.wav`, import.meta.url), pcm16ToWav(Buffer.concat(audio), RATE));
  const s = score(u, calls);
  return { id: u.id, outcome, latencyMs: firstAudio ? Math.round(firstAudio - speechEnd) : null, heard, reply: transcript, calls, ...s };
}

const rows = [];
for (const u of loadUtterances()) {
  const r = await runOne(u);
  console.log(`${r.pass ? "PASS" : "FAIL"} ${u.id} ${r.latencyMs} ms | heard: ${r.heard} | reply: ${r.reply}`);
  rows.push(r);
}
saveResults("openai", VARIANT, rows);
