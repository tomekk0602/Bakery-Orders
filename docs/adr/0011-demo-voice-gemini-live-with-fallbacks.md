---
status: accepted
date: 2026-11-24
decision-makers: owner
---

# ADR-0011: The customer call runs on Gemini Live with the catalogue enum and a speech vocabulary; a free cascade with Gemini Transcribe Live is the fallback, `gpt-transcribe` the paid backup; staff dictation uses Gemini Flash-Lite

## Context and Problem Statement

ADR-0005 chose cost-free components for the demo — the browser's speech recognition and synthesis
with a free-tier text model — before any voice measurement existed. On 2026-11-24 the free tier of
the Gemini API turned out to include a speech-to-speech model (Gemini Live) and a streaming
transcriber (Gemini Transcribe Live), and both were measured on our Czech clips. Which components
carry the customer call and the staff dictation in the demo, and what takes over when they fail?

## Decision Drivers

- Czech orders understood, product names heard right, nothing guessed (ADR-0003, ADR-0010).
- Latency: the first word of the answer soon after the caller stops (phone conversation).
- No spend without the owner's yes (constitution VI).
- Free-tier limits large enough for several reviewers (research R10).
- A failure is never silent (constitution III).

## Considered Options

- A — Gemini Live (speech to speech) for the call; a cascade as fallback
- B — a cascade for the call: transcriber → text model → speech synthesis, with
  - B1 the browser's speech recognition (ADR-0005 as written)
  - B2 Gemini 3.5 Transcribe Live (free)
  - B3 `gpt-transcribe` (paid)
- C — a local transcriber

For staff dictation (text in, order card out):

- D1 Gemini 3.5 Flash-Lite · D2 Gemini 3.6 / 3.8 Flash · D3 Gemma 4 31B

## Decision Outcome

Chosen (owner, 2026-11-24):

**Customer call — option A, Gemini 3.8 Live**, configured with the catalogue IDs as an enum, the
"do not infer, ask" tool description and the product vocabulary (ADR-0010). Measured (research R12):
9/10 orders right on clean audio and 8/10 on phone-band audio, every remaining miss being correct
behaviour (asking for an unheard name or quantity); first audio after the end of speech 3.3 s median
in both variants, 5.2 s worst. The vocabulary fixed the misheard "pět kaiserek" (R7 → R12).

**Fallback when Live fails or its quota is exhausted — option B2**, a free cascade: Gemini 3.5
Transcribe Live with the vocabulary (24/25 key terms on both variants, R12) → Gemini 3.5 Flash-Lite
with the same tools → the browser's speech synthesis. The call screen says that the call continues in
a simpler mode; if the cascade fails too, it says so and offers the web form (FR-016).

**Paid backup — option B3, `gpt-transcribe`**, in the same cascade, **not measured now** (owner,
2026-11-24). It is the backup because it holds the best transcription result the owner has measured
(an earlier project, Czech-English technical speech: 21.88% WER, 83.5% of terms recognised with
hints, 1.33 s per 5-second clip — not bakery orders). It is switched on and measured only with the
owner's yes.

**Staff dictation — D1, Gemini 3.5 Flash-Lite** with native function calling: 10/10 single
utterances and 5/6 dialogues on the text suite (R8); 15 requests a minute and 500 a day on the free
tier (R10), about 250 dictations a day. D3 (Gemma 4 31B, 14,400 requests a day) is the unmeasured
alternative if the daily limit is reached.

ADR-0005 is superseded: its cascade on the browser's recognition (B1) is no longer the primary path.

### Consequences

- Good, because the demo has a natural Czech voice, interruptions and measured accuracy at zero cost.
- Good, because each layer has a named successor: Live → free cascade → paid transcriber; the web
  form and the staff app work without any of them.
- Bad, because a vocabulary can over-correct: Transcribe Live turned Slovak "päť croissantov" into
  "50 croissantů" (R12). Mitigation: the agent reads every quantity back before saving (FR-005,
  FR-006), and the vocabulary holds only product names and their forms.
- Bad, because Gemini Live's limit is 65K tokens a minute on the free tier (R10); the exact token
  cost of one minute of a call is not measured, so the number of simultaneous calls the demo carries
  is an estimate until timed.
- Bad, because every run so far is one run per case; the spread comes from the simulated-customer
  suite (FR-029).

### Confirmation

- The Live session is created only with the enum, the vocabulary and the bakery's tools; a test
  checks the session configuration the token is issued for.
- A test forces Live to fail and asserts that the call continues in the cascade and that the screen
  says so; a second forces the cascade to fail and asserts the form is offered.
- The scripted suite and the simulated-customer suite are re-run before the demo on the chosen
  configuration; the results go into `research.md`.

## Pros and Cons of the Options

### A — Gemini Live

- Good, because measured best on our clips, natural voice, interruptions, transcript of both sides.
- Bad, because one provider; free-tier terms can change.

### B1 — Browser recognition cascade

- Good, because free and needs no key.
- Bad, because not measured on our clips, robotic voice, no Firefox; Chrome sends the audio to
  Google anyway.

### B2 — Transcribe Live cascade

- Good, because free, measured (24/25 key terms), the same provider's key.
- Bad, because three steps add latency; the over-correction above.

### B3 — `gpt-transcribe` cascade

- Good, because the strongest transcription result the owner has measured, with hints.
- Bad, because paid and not measured on bakery orders.

### C — Local transcriber

- Bad, because we have no server to run it (ADR-0007); in the caller's browser it is a download of
  hundreds of MB and slow on phones; the owner measured a large local Whisper model at 33.28% WER on
  Czech, 2.9× its published figure. Local recognition stays in the staff app as the phone's built-in
  recogniser (ADR-0009).

### D2 — Gemini 3.6 / 3.8 Flash

- Bad, because 20 requests a day on the free tier; 3.8 Flash answered only 503 "high demand" (R8).

## More Information

- `specs/001-voice-ordering/research.md` R7, R8, R10, R11, R12.
- Gemini API pricing and free tier: https://aistudio.google.com/docs/pricing (read 2026-11-24).
- Live transcription: https://ai.google.dev/gemini-api/docs/live-api/live-transcribe
- Supersedes ADR-0005.
