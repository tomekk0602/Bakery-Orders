// Gemini Live (speech to speech, free tier — ADR-0005 candidate) on the scripted Czech utterances.
// Usage: node --env-file=.env run-gemini-live.mjs [clean|phone]
import { GoogleGenAI, Modality } from "@google/genai";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { INSTRUCTIONS, TOOLS, VOCABULARY, runTool, loadUtterances, score, saveResults, pcm16ToWav } from "./common.mjs";

const MODEL = process.env.GEMINI_LIVE_MODEL ?? "gemini-3.8-live";
const VARIANT = process.argv[2] ?? "clean";
// LABEL names the run in out/ so runs with different settings are kept side by side.
const LABEL = process.env.LABEL ? `-${process.env.LABEL}` : "";
const USE_VOCABULARY = process.env.VOCABULARY === "1";
const IN_RATE = 16000; // Live API input: 16-bit PCM, 16 kHz
const OUT_RATE = 24000; // Live API output: 16-bit PCM, 24 kHz
const CHUNK_MS = 100;
const TRAILING_SILENCE_MS = 1500;
const QUIET_END_MS = 3000;
const TURN_TIMEOUT_MS = 30000;
if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing in spikes/czech-voice/.env");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: "v1beta" } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Same JSON Schemas as the other providers, passed as JSON Schema.
const LIVE_TOOLS = [{ functionDeclarations: TOOLS.map((t) => ({ name: t.name, description: t.description, parametersJsonSchema: t.parameters })) }];

async function runOne(u) {
  const calls = [];
  const audio = [];
  let heard = "";
  let reply = "";
  let speechEnd = null;
  let firstAudio = null;
  let lastEvent = performance.now();
  let error = null;

  const session = await ai.live.connect({
    model: MODEL,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { languageCode: "cs-CZ" },
      systemInstruction: { parts: [{ text: INSTRUCTIONS }] },
      tools: LIVE_TOOLS,
      inputAudioTranscription: USE_VOCABULARY ? { languageCodes: ["cs-CZ"], customVocabulary: VOCABULARY } : {},
      outputAudioTranscription: {},
    },
    callbacks: {
      onmessage: (m) => {
        lastEvent = performance.now();
        const sc = m.serverContent;
        for (const p of sc?.modelTurn?.parts ?? []) {
          if (p.inlineData?.data && speechEnd) {
            if (firstAudio == null) firstAudio = performance.now();
            audio.push(Buffer.from(p.inlineData.data, "base64"));
          }
        }
        if (sc?.inputTranscription?.text) heard += sc.inputTranscription.text;
        if (sc?.outputTranscription?.text) reply += sc.outputTranscription.text;
        const fcs = m.toolCall?.functionCalls ?? [];
        if (fcs.length) {
          session.sendToolResponse({
            functionResponses: fcs.map((fc) => {
              calls.push({ name: fc.name, args: fc.args ?? {} });
              return { id: fc.id, name: fc.name, response: runTool(fc.name, fc.args ?? {}) };
            }),
          });
        }
      },
      onerror: (e) => { error = e?.message ?? String(e); },
      onclose: (e) => { if (e?.reason && !error && e.code !== 1000) error = `closed ${e.code} ${e.reason}`; },
    },
  });

  // Real-time pacing, so "end of speech" is when a caller would stop talking.
  const pcm = readFileSync(new URL(`./audio/${u.id}.${VARIANT}.${IN_RATE}.pcm`, import.meta.url));
  const step = (IN_RATE * 2 * CHUNK_MS) / 1000;
  const mimeType = `audio/pcm;rate=${IN_RATE}`;
  for (let i = 0; i < pcm.length; i += step) {
    session.sendRealtimeInput({ audio: { data: pcm.subarray(i, i + step).toString("base64"), mimeType } });
    await sleep(CHUNK_MS);
  }
  speechEnd = performance.now();
  const silence = Buffer.alloc(step).toString("base64");
  let outcome = "timeout";
  while (performance.now() - speechEnd < TURN_TIMEOUT_MS && !error) {
    session.sendRealtimeInput({ audio: { data: silence, mimeType } });
    await sleep(CHUNK_MS);
    if (performance.now() - speechEnd < TRAILING_SILENCE_MS) continue;
    if (firstAudio && performance.now() - lastEvent > QUIET_END_MS) { outcome = "done"; break; }
  }
  session.close();
  mkdirSync(new URL("./out/audio/", import.meta.url), { recursive: true });
  writeFileSync(new URL(`./out/audio/gemini-live${LABEL}-${VARIANT}-${u.id}.wav`, import.meta.url), pcm16ToWav(Buffer.concat(audio), OUT_RATE));
  const s = score(u, calls);
  return { id: u.id, outcome: error ? `error: ${error}` : outcome, latencyMs: firstAudio ? Math.round(firstAudio - speechEnd) : null, heard, reply, calls, ...s };
}

const rows = [];
for (const u of loadUtterances()) {
  const r = await runOne(u);
  console.log(`${r.pass ? "PASS" : "FAIL"} ${u.id} ${r.latencyMs} ms ${r.outcome} | heard: ${r.heard} | reply: ${r.reply}`);
  rows.push(r);
}
saveResults(`gemini-live${LABEL}`, VARIANT, rows);
