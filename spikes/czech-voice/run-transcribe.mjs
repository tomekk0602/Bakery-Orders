// Transcription only: Gemini 3.5 Transcribe Live (free tier) on the same Czech audio, with and
// without the product vocabulary; also scores what Gemini Live "heard" in earlier runs, so the
// recognisers compare on the same clips.
// Usage: node --env-file=.env run-transcribe.mjs [clean|phone]
import { GoogleGenAI, Modality } from "@google/genai";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { VOCABULARY, loadUtterances } from "./common.mjs";

const MODEL = process.env.TRANSCRIBE_MODEL ?? "gemini-3.5-transcribe-live";
const VARIANT = process.argv[2] ?? "clean";
const RATE = 16000;
const CHUNK_MS = 100;
const QUIET_END_MS = 2500;
const TIMEOUT_MS = 20000;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: "v1beta" } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The words that carry the order: product stems by id, plus the customer's name.
const STEMS = {
  "chleb-kminovy": "kmínov", "chleb-zitny": "žitn", "chleb-celozrnny": "celozrnn", rohlik: "rohlík",
  houska: "housk", kaiserka: "kaiser", "kolac-tvarohovy": "tvaroh", "kolac-makovy": "makov",
  "buchta-povidlova": "povidl", croissant: "croissant",
};
const EXTRA = { "u05-unknown": ["baget", "proch"], "u08-human": ["člověk"] };
function keyTerms(u) {
  if (EXTRA[u.id]) return EXTRA[u.id];
  return [...Object.keys(u.expect.items).map((id) => STEMS[id]), u.expect.name.toLowerCase().slice(0, 5)];
}

const norm = (s) => s.toLowerCase().normalize("NFC").replace(/[.,!?;:"„“]/g, " ").split(/\s+/).filter(Boolean);
// Word error rate against the script. Digits vs words ("10" vs "deset") count as errors, so WER is
// pessimistic for every recogniser alike; the key-term recall is the number that matters here.
function wer(ref, hyp) {
  const r = norm(ref), h = norm(hyp);
  const d = Array.from({ length: r.length + 1 }, (_, i) => [i, ...Array(h.length).fill(0)]);
  for (let j = 1; j <= h.length; j++) d[0][j] = j;
  for (let i = 1; i <= r.length; i++)
    for (let j = 1; j <= h.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
  return d[r.length][h.length] / r.length;
}
function scoreText(u, text) {
  const t = text.toLowerCase();
  const terms = keyTerms(u);
  const missed = terms.filter((k) => !t.includes(k));
  return { wer: wer(u.text, text), terms: terms.length, found: terms.length - missed.length, missed };
}

async function transcribe(u, withVocabulary) {
  let text = "", last = performance.now(), error = null;
  const session = await ai.live.connect({
    model: MODEL,
    config: {
      responseModalities: [Modality.TEXT],
      inputAudioTranscription: withVocabulary ? { languageCodes: ["cs-CZ"], customVocabulary: VOCABULARY } : { languageCodes: ["cs-CZ"] },
    },
    callbacks: {
      onmessage: (m) => {
        const t = m.serverContent?.inputTranscription?.text;
        if (t) { text += t; last = performance.now(); }
      },
      onerror: (e) => { error = e?.message ?? String(e); },
    },
  });
  const pcm = readFileSync(new URL(`./audio/${u.id}.${VARIANT}.${RATE}.pcm`, import.meta.url));
  const step = (RATE * 2 * CHUNK_MS) / 1000;
  const mimeType = `audio/pcm;rate=${RATE}`;
  for (let i = 0; i < pcm.length; i += step) {
    session.sendRealtimeInput({ audio: { data: pcm.subarray(i, i + step).toString("base64"), mimeType } });
    await sleep(CHUNK_MS);
  }
  const end = performance.now();
  const silence = Buffer.alloc(step).toString("base64");
  while (performance.now() - end < TIMEOUT_MS && !error) {
    session.sendRealtimeInput({ audio: { data: silence, mimeType } });
    await sleep(CHUNK_MS);
    if (text && performance.now() - last > QUIET_END_MS) break;
  }
  session.close();
  return { text: text.trim(), error };
}

const rows = [];
for (const u of loadUtterances()) {
  const plain = await transcribe(u, false);
  const vocab = await transcribe(u, true);
  rows.push({ id: u.id, ref: u.text, plain: { ...plain, ...scoreText(u, plain.text) }, vocab: { ...vocab, ...scoreText(u, vocab.text) } });
  console.log(`${u.id}\n  plain: ${plain.error ?? plain.text}\n  vocab: ${vocab.error ?? vocab.text}`);
}

// Earlier Gemini Live runs: what the speech-to-speech model reported hearing.
const live = {};
for (const label of ["gemini-live", "gemini-live-vocab"]) {
  const f = new URL(`./out/${label}-${VARIANT}.json`, import.meta.url);
  if (existsSync(f)) live[label] = JSON.parse(readFileSync(f, "utf8"));
}

writeFileSync(new URL(`./out/transcribe-${VARIANT}.json`, import.meta.url), JSON.stringify({ rows, live }, null, 2));
const sum = (list) => {
  const t = list.reduce((a, s) => a + s.terms, 0), f = list.reduce((a, s) => a + s.found, 0);
  const w = list.reduce((a, s) => a + s.wer, 0) / list.length;
  return `key terms ${f}/${t}, mean WER ${(w * 100).toFixed(1)}%`;
};
const utts = loadUtterances();
console.log(`\n${VARIANT}:`);
console.log(`  ${MODEL}, no vocabulary:   ${sum(rows.map((r) => r.plain))}`);
console.log(`  ${MODEL}, with vocabulary: ${sum(rows.map((r) => r.vocab))}`);
for (const [label, data] of Object.entries(live)) {
  const s = data.map((r) => scoreText(utts.find((u) => u.id === r.id), r.heard ?? ""));
  console.log(`  ${label} (heard):        ${sum(s)}`);
}
for (const r of rows) {
  const m = [...new Set([...r.plain.missed.map((x) => `plain:${x}`), ...r.vocab.missed.map((x) => `vocab:${x}`)])];
  if (m.length) console.log(`  missed ${r.id}: ${m.join(" ")}`);
}
